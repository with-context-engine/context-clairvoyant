import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface Message {
	role: "user" | "assistant";
	content: string;
	createdAt: string;
}

interface FollowupChatPageProps {
	mentraUserId: string;
}

export function FollowupChatPage({ mentraUserId }: FollowupChatPageProps) {
	const navigate = useNavigate();
	const { followupId } = useParams<{ followupId: string }>();

	const [input, setInput] = useState("");
	const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const followup = useQuery(
		api.followups.getById,
		followupId ? { id: followupId as Id<"followups"> } : "skip",
	);

	const existingMessages = useQuery(
		api.followupsChatQueries.getMessages,
		followupId ? { followupId: followupId as Id<"followups"> } : "skip",
	);

	const sendMessage = useAction(api.followupsChat.sendFollowupMessage);

	const handleBack = () => {
		navigate("/followups");
	};

	useEffect(() => {
		if (existingMessages && pendingMessages.length > 0) {
			const existingContents = new Set(
				existingMessages.map((m) => `${m.role}:${m.content}`),
			);
			const remaining = pendingMessages.filter(
				(m) => !existingContents.has(`${m.role}:${m.content}`),
			);
			if (remaining.length !== pendingMessages.length) {
				setPendingMessages(remaining);
			}
		}
	}, [existingMessages, pendingMessages]);

	const allMessages = [...(existingMessages ?? []), ...pendingMessages];
	const messageCount = allMessages.length;

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally scroll on message count change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messageCount]);

	const handleSend = async () => {
		if (!input.trim() || isLoading || !followupId) return;

		const userMessage: Message = {
			role: "user",
			content: input.trim(),
			createdAt: new Date().toISOString(),
		};

		setPendingMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);
		setError(null);

		try {
			const result = await sendMessage({
				mentraUserId,
				followupId: followupId as Id<"followups">,
				content: userMessage.content,
			});

			if (result.success && result.response) {
				const assistantMessage: Message = {
					role: "assistant",
					content: result.response,
					createdAt: new Date().toISOString(),
				};
				setPendingMessages((prev) => [...prev, assistantMessage]);
			} else {
				setError(result.error ?? "Failed to send message");
			}
		} catch (_err) {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	if (!followupId) {
		return (
			<div className="flex items-center justify-center h-[80vh] text-foreground/50">
				Invalid follow-up
			</div>
		);
	}

	if (followup === undefined) {
		return (
			<div className="flex items-center justify-center h-[80vh] text-foreground/50">
				Loading...
			</div>
		);
	}

	if (followup === null) {
		return (
			<div className="flex items-center justify-center h-[80vh] text-foreground/50">
				Follow-up not found
			</div>
		);
	}

	return (
		<div className="fixed inset-0 flex flex-col bg-background z-[60]">
			<div className="flex items-center gap-3 p-4 border-b-2 border-border bg-background shrink-0">
				<button
					type="button"
					onClick={handleBack}
					className="text-foreground hover:text-foreground/70 text-2xl leading-none"
					aria-label="Go back"
				>
					←
				</button>
				<div>
					<h2 className="text-lg font-heading">{followup.topic}</h2>
					<p className="text-xs text-foreground/50">
						Chat about this follow-up
					</p>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{existingMessages === undefined ? (
					<div className="flex items-center justify-center h-full text-foreground/50">
						Loading...
					</div>
				) : allMessages.length === 0 ? (
					<div className="flex items-center justify-center h-full text-foreground/50">
						Ask about this topic
					</div>
				) : (
					allMessages.map((msg, idx) => (
						<div
							key={`${msg.createdAt}-${idx}`}
							className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
						>
							<div
								className={`max-w-[80%] px-4 py-2 rounded-base border-2 border-border ${
									msg.role === "user"
										? "bg-main text-main-foreground"
										: "bg-secondary-background text-foreground"
								}`}
							>
								<p className="text-sm whitespace-pre-wrap">{msg.content}</p>
							</div>
						</div>
					))
				)}
				{isLoading && (
					<div className="flex justify-start">
						<div className="max-w-[80%] px-4 py-2 rounded-base border-2 border-border bg-secondary-background text-foreground">
							<p className="text-sm text-foreground/50">Thinking...</p>
						</div>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>

			{error && (
				<div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-t-2 border-border shrink-0">
					{error}
				</div>
			)}

			<div className="p-4 border-t-2 border-border bg-background flex gap-2 shrink-0 safe-area-bottom">
				<Input
					ref={inputRef}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Ask about this topic..."
					disabled={isLoading}
					className="flex-1"
				/>
				<Button onClick={handleSend} disabled={isLoading || !input.trim()}>
					Send
				</Button>
			</div>
		</div>
	);
}
