export class RateLimiter {
	private lastEventTime: number = 0;
	private readonly minIntervalMs: number;

	constructor(minIntervalMs: number) {
		this.minIntervalMs = minIntervalMs;
	}

	/**
	 * Checks if enough time has passed since the last event
	 * @param logger Optional logger for debug information
	 * @param context Optional context string for logging
	 * @returns true if the event should be skipped, false if it should proceed
	 */
	shouldSkip(logger?: { info: (message: string) => void }, context?: string): boolean {
		const currentTime = Date.now();
		const timeSinceLastEvent = currentTime - this.lastEventTime;
		this.lastEventTime = currentTime;
		
		if (timeSinceLastEvent < this.minIntervalMs) {
			const contextPrefix = context ? `[${context}] ` : '';
			logger?.info(`${contextPrefix}Skipping. Time since last event: ${timeSinceLastEvent}ms`);
			return true;
		}
		return false;
	}
	reset(): void {
		this.lastEventTime = 0;
	}
	getTimeSinceLastEvent(): number {
		return Date.now() - this.lastEventTime;
	}
}
