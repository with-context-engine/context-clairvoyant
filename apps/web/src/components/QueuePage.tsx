import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface QueuePageProps {
	mentraUserId: string;
}

const PREFIX_COLORS: Record<string, { bg: string; text: string; label: string }> = {
	W: { bg: "bg-blue-100", text: "text-blue-700", label: "Weather" },
	M: { bg: "bg-purple-100", text: "text-purple-700", label: "Memory" },
	S: { bg: "bg-green-100", text: "text-green-700", label: "Search" },
	R: { bg: "bg-orange-100", text: "text-orange-700", label: "Recall" },
	H: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Hints" },
	K: { bg: "bg-cyan-100", text: "text-cyan-700", label: "Knowledge" },
	N: { bg: "bg-pink-100", text: "text-pink-700", label: "Note" },
};

function formatTime(isoString: string): string {
	const date = new Date(isoString);
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

function formatRelativeTime(isoString: string): string {
	const date = new Date(isoString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHour = Math.floor(diffMin / 60);

	if (diffSec < 60) return "just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHour < 24) return `${diffHour}h ago`;
	return formatTime(isoString);
}

interface MessageCardProps {
	message: string;
	prefix: string;
	status: "queued" | "displayed" | "cancelled";
	createdAt: string;
	displayedAt?: string;
}

function MessageCard({ message, prefix, status, createdAt, displayedAt }: MessageCardProps) {
	const prefixStyle = PREFIX_COLORS[prefix] || { bg: "bg-gray-100", text: "text-gray-700", label: prefix };
	
	const statusStyles = {
		queued: "border-yellow-300 bg-yellow-50",
		displayed: "border-border",
		cancelled: "border-gray-300 bg-gray-50 opacity-60",
	};

	const cleanMessage = message.replace(/^\/\/ Clairvoyant\n[A-Z]: /, "");

	return (
		<div className={`p-3 rounded-base border-2 ${statusStyles[status]} transition-opacity`}>
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className={`px-2 py-0.5 rounded text-xs font-semibold ${prefixStyle.bg} ${prefixStyle.text}`}>
							{prefixStyle.label}
						</span>
						{status === "queued" && (
							<span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-200 text-yellow-800">
								Pending
							</span>
						)}
						{status === "cancelled" && (
							<span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-600">
								Cancelled
							</span>
						)}
					</div>
					<p className="text-sm text-foreground break-words">{cleanMessage}</p>
				</div>
				<div className="text-xs text-foreground/50 whitespace-nowrap">
					{displayedAt ? formatRelativeTime(displayedAt) : formatRelativeTime(createdAt)}
				</div>
			</div>
		</div>
	);
}

export function QueuePage({ mentraUserId }: QueuePageProps) {
	const messages = useQuery(api.displayQueue.getRecentByUser, {
		mentraUserId,
		limit: 20,
	});

	if (messages === undefined) {
		return (
			<div className="space-y-6">
				<h2 className="text-xl font-semibold">Message Queue</h2>
				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<Card key={i} className="animate-pulse">
							<CardContent className="py-4">
								<div className="h-4 bg-gray-200 rounded w-full mb-2" />
								<div className="h-4 bg-gray-200 rounded w-3/4" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	const queuedMessages = messages.filter((m) => m.status === "queued");
	const recentMessages = messages.filter((m) => m.status !== "queued");

	return (
		<div className="space-y-6">
			<h2 className="text-xl font-semibold">Message Queue</h2>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-lg flex items-center gap-2">
						<span className="relative flex h-3 w-3">
							{queuedMessages.length > 0 && (
								<>
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
									<span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
								</>
							)}
							{queuedMessages.length === 0 && (
								<span className="relative inline-flex rounded-full h-3 w-3 bg-gray-300" />
							)}
						</span>
						Pending ({queuedMessages.length})
					</CardTitle>
				</CardHeader>
				<CardContent>
					{queuedMessages.length === 0 ? (
						<p className="text-sm text-foreground/50">No messages in queue</p>
					) : (
						<div className="space-y-2">
							{queuedMessages.map((msg) => (
								<MessageCard
									key={msg._id}
									message={msg.message}
									prefix={msg.prefix}
									status={msg.status}
									createdAt={msg.createdAt}
									displayedAt={msg.displayedAt}
								/>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-lg">Recent</CardTitle>
				</CardHeader>
				<CardContent>
					{recentMessages.length === 0 ? (
						<p className="text-sm text-foreground/50">No recent messages</p>
					) : (
						<div className="space-y-2">
							{recentMessages.map((msg) => (
								<MessageCard
									key={msg._id}
									message={msg.message}
									prefix={msg.prefix}
									status={msg.status}
									createdAt={msg.createdAt}
									displayedAt={msg.displayedAt}
								/>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
