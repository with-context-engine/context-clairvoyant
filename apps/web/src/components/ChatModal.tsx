import { api } from "@convex/_generated/api";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface ChatModalProps {
	isOpen: boolean;
	onClose: () => void;
	mentraUserId: string;
	date: string;
	daySummary: { summary: string; topics: string[] };
}

interface Message {
	role: "user" | "assistant";
	content: string;
	createdAt: string;
}

export function ChatModal({
	isOpen,
	onClose,
	mentraUserId,
	date,
	daySummary,
}: ChatModalProps) {
	const [input, setInput] = useState("");
	const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesSentRef = useRef(false);

	const existingMessages = useQuery(
		api.chatQueries.getMessages,
		isOpen ? { mentraUserId, date } : "skip",
	);
	const sendMessage = useAction(api.chat.sendMessage);
	const resynthesizeDay = useAction(api.chat.resynthesizeDay);

	const handleClose = useCallback(async () => {
		if (messagesSentRef.current) {
			resynthesizeDay({ mentraUserId, date });
		}
		messagesSentRef.current = false;
		onClose();
	}, [mentraUserId, date, resynthesizeDay, onClose]);

	const allMessages = [...(existingMessages ?? []), ...pendingMessages];

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [allMessages.length]);

	useEffect(() => {
		if (!isOpen) {
			setPendingMessages([]);
			setInput("");
			setError(null);
		}
	}, [isOpen]);

	const handleSend = async () => {
		if (!input.trim() || isLoading) return;

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
				date,
				content: userMessage.content,
			});

			if (result.success && result.response) {
				messagesSentRef.current = true;
				const assistantMessage: Message = {
					role: "assistant",
					content: result.response,
					createdAt: new Date().toISOString(),
				};
				setPendingMessages((prev) => [...prev, assistantMessage]);
			} else {
				setError(result.error ?? "Failed to send message");
			}
		} catch (err) {
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

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div
				className="absolute inset-0 bg-black/50"
				onClick={handleClose}
				onKeyDown={(e) => e.key === "Escape" && handleClose()}
			/>
			<div className="relative z-10 w-full max-w-2xl h-[80vh] mx-4 bg-background border-2 border-border rounded-base shadow-shadow flex flex-col">
				<div className="flex items-center justify-between p-4 border-b-2 border-border">
					<h2 className="text-lg font-heading">Chat with Memory</h2>
					<button
						type="button"
						onClick={handleClose}
						className="text-foreground/50 hover:text-foreground text-xl leading-none"
					>
						×
					</button>
				</div>

				<div className="p-4 border-b-2 border-border bg-secondary-background">
					<p className="text-sm text-foreground">{daySummary.summary}</p>
					{daySummary.topics.length > 0 && (
						<div className="flex flex-wrap gap-2 mt-2">
							{daySummary.topics.map((topic) => (
								<span
									key={topic}
									className="px-2 py-0.5 bg-main/10 text-main rounded-base text-xs border border-main/20"
								>
									{topic}
								</span>
							))}
						</div>
					)}
				</div>

				<div className="flex-1 overflow-y-auto p-4 space-y-4">
					{existingMessages === undefined ? (
						<div className="flex items-center justify-center h-full text-foreground/50">
							Loading...
						</div>
					) : allMessages.length === 0 ? (
						<div className="flex items-center justify-center h-full text-foreground/50">
							Ask anything about this day
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
					<div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-t-2 border-border">
						{error}
					</div>
				)}

				<div className="p-4 border-t-2 border-border flex gap-2">
					<Input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask about this day..."
						disabled={isLoading}
						className="flex-1"
					/>
					<Button onClick={handleSend} disabled={isLoading || !input.trim()}>
						Send
					</Button>
				</div>
			</div>
		</div>
	);
}
