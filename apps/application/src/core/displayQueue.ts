import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { type AppSession, ViewType } from "@mentra/sdk";
import { convexClient } from "./convex";

interface QueuedMessage {
	id: string;
	convexId?: Id<"displayQueue">;
	text: string;
	prefix: string;
	durationMs: number;
	priority: number;
}

type GapSpeed = "short" | "medium" | "long";

const GAP_SPEEDS: Record<GapSpeed, number> = {
	short: 1000,
	medium: 3500,
	long: 5000,
};

interface DisplayQueueConfig {
	gapMs: number;
	maxQueueLength: number;
	prefixPriorities: string[];
	gapSpeed?: GapSpeed;
}

const DEFAULT_PREFIX_ORDER = ["W", "K", "S", "M", "H", "R", "N", "F"];

const DEFAULT_CONFIG: DisplayQueueConfig = {
	gapMs: 3500,
	maxQueueLength: 10,
	prefixPriorities: DEFAULT_PREFIX_ORDER,
};

export class DisplayQueueManager {
	private queue: QueuedMessage[] = [];
	private isProcessing = false;
	private session: AppSession;
	private mentraUserId: string;
	private sessionId: string;
	private config: DisplayQueueConfig;
	private currentLoadingId: string | null = null;
	private isCancelled = false;

	constructor(
		session: AppSession,
		mentraUserId: string,
		sessionId: string,
		config?: Partial<DisplayQueueConfig>,
	) {
		this.session = session;
		this.mentraUserId = mentraUserId;
		this.sessionId = sessionId;
		this.config = { ...DEFAULT_CONFIG, ...config };
		if (config?.gapSpeed) {
			this.config.gapMs = GAP_SPEEDS[config.gapSpeed] ?? 3500;
		}
	}

	enqueue(message: Omit<QueuedMessage, "id" | "convexId">): string {
		const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

		if (this.queue.length >= this.config.maxQueueLength) {
			this.session.logger.warn(
				`[DisplayQueue] Queue full (${this.config.maxQueueLength}), dropping oldest message`,
			);
			const dropped = this.queue.shift();
			if (dropped?.convexId) {
				void convexClient.mutation(api.displayQueue.markCancelled, {
					id: dropped.convexId,
				});
			}
		}

		const queuedMessage: QueuedMessage = {
			id,
			text: message.text,
			prefix: message.prefix,
			durationMs: message.durationMs,
			priority: message.priority ?? 3,
		};

		this.queue.push(queuedMessage);

		this.logToConvex(queuedMessage)
			.then(() => {
				this.scheduleProcessQueue();
			})
			.catch((error) => {
				this.session.logger.error(
					`[DisplayQueue] Failed to log to Convex: ${String(error)}`,
				);
				this.scheduleProcessQueue();
			});

		return id;
	}

	private processQueueTimeout: ReturnType<typeof setTimeout> | null = null;

	private scheduleProcessQueue(): void {
		if (this.isProcessing || this.isCancelled) {
			return;
		}
		if (this.processQueueTimeout) {
			return;
		}
		this.processQueueTimeout = setTimeout(() => {
			this.processQueueTimeout = null;
			void this.processQueue();
		}, 50);
	}

	showLoading(text: string, _prefix: string): string {
		const id = `loading-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
		this.currentLoadingId = id;

		this.session.layouts.showTextWall(text, {
			view: ViewType.MAIN,
			durationMs: 30000,
		});

		this.session.logger.info(`[DisplayQueue] Showing loading: ${id}`);

		return id;
	}

	replaceLoading(
		loadingId: string,
		message: Omit<QueuedMessage, "id" | "convexId">,
	): void {
		if (this.currentLoadingId === loadingId) {
			this.currentLoadingId = null;

			this.session.layouts.showTextWall(message.text, {
				view: ViewType.MAIN,
				durationMs: message.durationMs,
			});

			void this.logToConvex({
				id: `replaced-${loadingId}`,
				...message,
				priority: message.priority ?? 3,
			}).then((convexId) => {
				if (convexId) {
					void convexClient.mutation(api.displayQueue.markDisplayed, {
						id: convexId,
					});
				}
			});

			this.session.logger.info(
				`[DisplayQueue] Replaced loading ${loadingId} with result`,
			);
		} else {
			this.session.logger.info(
				`[DisplayQueue] Loading ${loadingId} no longer current, queueing message`,
			);
			this.enqueue(message);
		}
	}

	async cancelAll(): Promise<void> {
		this.isCancelled = true;
		this.currentLoadingId = null;
		this.queue = [];

		if (this.processQueueTimeout) {
			clearTimeout(this.processQueueTimeout);
			this.processQueueTimeout = null;
		}

		try {
			// Delete all messages for this session (not just cancel)
			await convexClient.mutation(api.displayQueue.deleteSessionMessages, {
				sessionId: this.sessionId,
			});
			this.session.logger.info(
				`[DisplayQueue] Deleted all messages for session ${this.sessionId}`,
			);
		} catch (error) {
			this.session.logger.error(
				`[DisplayQueue] Failed to delete session messages: ${String(error)}`,
			);
		}
	}

	async cancel(id: string): Promise<void> {
		const index = this.queue.findIndex((msg) => msg.id === id);
		if (index !== -1) {
			const removed = this.queue.splice(index, 1)[0];
			if (removed?.convexId) {
				try {
					await convexClient.mutation(api.displayQueue.markCancelled, {
						id: removed.convexId,
					});
				} catch (error) {
					this.session.logger.error(
						`[DisplayQueue] Failed to mark message cancelled: ${String(error)}`,
					);
				}
			}
			this.session.logger.info(`[DisplayQueue] Cancelled message ${id}`);
		}
	}

	private async processQueue(): Promise<void> {
		if (this.isProcessing || this.isCancelled) {
			return;
		}

		this.isProcessing = true;

		this.queue.sort((a, b) => {
			const priorities = this.config.prefixPriorities;
			const aIndex = priorities.indexOf(a.prefix);
			const bIndex = priorities.indexOf(b.prefix);
			const aPriority = aIndex === -1 ? 999 : aIndex;
			const bPriority = bIndex === -1 ? 999 : bIndex;
			return aPriority - bPriority;
		});

		try {
			while (this.queue.length > 0 && !this.isCancelled) {
				const message = this.queue.shift();
				if (!message) break;

				if (this.currentLoadingId) {
					this.session.logger.info(
						`[DisplayQueue] Waiting for loading to complete before showing: ${message.id}`,
					);
					this.queue.unshift(message);
					await new Promise((resolve) => setTimeout(resolve, 500));
					continue;
				}

				this.session.layouts.showTextWall(message.text, {
					view: ViewType.MAIN,
					durationMs: message.durationMs,
				});

				this.session.logger.info(
					`[DisplayQueue] Displayed: ${message.id} (${message.prefix})`,
				);

				if (message.convexId) {
					void convexClient.mutation(api.displayQueue.markDisplayed, {
						id: message.convexId,
					});
				}

				if (this.queue.length > 0 && !this.isCancelled) {
					await new Promise((resolve) =>
						setTimeout(resolve, this.config.gapMs),
					);
				}
			}
		} finally {
			this.isProcessing = false;
		}
	}

	private async logToConvex(
		message: QueuedMessage,
	): Promise<Id<"displayQueue"> | undefined> {
		try {
			const convexId = await convexClient.mutation(api.displayQueue.enqueue, {
				mentraUserId: this.mentraUserId,
				sessionId: this.sessionId,
				message: message.text,
				prefix: message.prefix,
				priority: message.priority,
			});

			const queuedMsg = this.queue.find((m) => m.id === message.id);
			if (queuedMsg) {
				queuedMsg.convexId = convexId;
			}

			return convexId;
		} catch (error) {
			this.session.logger.error(
				`[DisplayQueue] Failed to log to Convex: ${String(error)}`,
			);
			return undefined;
		}
	}

	get queueLength(): number {
		return this.queue.length;
	}

	get isActive(): boolean {
		return this.isProcessing || this.currentLoadingId !== null;
	}
}
