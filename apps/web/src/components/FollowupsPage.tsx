import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";

interface FollowupsPageProps {
	userId: Id<"users">;
}

function formatRelativeTime(isoString: string): string {
	const date = new Date(isoString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHour = Math.floor(diffMin / 60);
	const diffDay = Math.floor(diffHour / 24);

	if (diffSec < 60) return "just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHour < 24) return `${diffHour}h ago`;
	if (diffDay < 7) return `${diffDay}d ago`;
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

function StatusBadge({
	status,
}: {
	status: "pending" | "completed" | "dismissed";
}) {
	const styles = {
		pending: "bg-yellow-100 text-yellow-800",
		completed: "bg-green-100 text-green-800",
		dismissed: "bg-gray-100 text-gray-600",
	};

	const labels = {
		pending: "Pending",
		completed: "Completed",
		dismissed: "Dismissed",
	};

	return (
		<span
			className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[status]}`}
		>
			{labels[status]}
		</span>
	);
}

export function FollowupsPage({ userId }: FollowupsPageProps) {
	const navigate = useNavigate();
	const followups = useQuery(api.followups.getByUser, { userId });
	const updateStatus = useMutation(api.followups.updateStatus);

	const handleComplete = async (id: Id<"followups">, e: React.MouseEvent) => {
		e.stopPropagation();
		await updateStatus({
			id,
			status: "completed",
			completedAt: new Date().toISOString(),
		});
	};

	const handleDismiss = async (id: Id<"followups">, e: React.MouseEvent) => {
		e.stopPropagation();
		await updateStatus({
			id,
			status: "dismissed",
		});
	};

	if (followups === undefined) {
		return (
			<div className="space-y-6">
				<h2 className="text-xl font-semibold">Follow-ups</h2>
				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<Card key={i} className="animate-pulse">
							<CardHeader>
								<div className="h-5 bg-gray-200 rounded w-32" />
							</CardHeader>
							<CardContent>
								<div className="h-4 bg-gray-200 rounded w-full mb-2" />
								<div className="h-4 bg-gray-200 rounded w-3/4" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	if (followups.length === 0) {
		return (
			<div className="space-y-6">
				<h2 className="text-xl font-semibold">Follow-ups</h2>
				<Card>
					<CardHeader>
						<CardTitle>No follow-ups yet</CardTitle>
						<CardDescription>
							Follow-ups will appear here when the AI suggests topics to revisit
							based on your conversations.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<h2 className="text-xl font-semibold">Follow-ups</h2>

			<div className="space-y-4">
				{followups.map(
					(followup: {
						_id: Id<"followups">;
						topic: string;
						summary: string;
						status: "pending" | "completed" | "dismissed";
						createdAt: string;
					}) => (
						<Card
							key={followup._id}
							className={followup.status === "pending" ? "cursor-pointer" : ""}
							onClick={() => {
								if (followup.status === "pending") {
									navigate(`/followups/chat/${followup._id}`);
								}
							}}
						>
							<CardHeader className="pb-2">
								<div className="flex items-center justify-between gap-2">
									<CardTitle className="text-lg">{followup.topic}</CardTitle>
									<StatusBadge status={followup.status} />
								</div>
							</CardHeader>
							<CardContent className="space-y-3">
								<p className="text-foreground text-sm">{followup.summary}</p>

								<div className="flex items-center justify-between">
									<p className="text-xs text-foreground/50">
										{formatRelativeTime(followup.createdAt)}
									</p>

									{followup.status === "pending" && (
										<div className="flex gap-2">
											<Button
												variant="neutral"
												size="sm"
												onClick={(e) => handleComplete(followup._id, e)}
											>
												Complete
											</Button>
											<Button
												variant="neutral"
												size="sm"
												onClick={(e) => handleDismiss(followup._id, e)}
											>
												Dismiss
											</Button>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					),
				)}
			</div>
		</div>
	);
}
