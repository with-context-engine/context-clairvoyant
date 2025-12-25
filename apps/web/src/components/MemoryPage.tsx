import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";

interface MemoryPageProps {
	mentraUserId: string;
}

function formatDate(dateStr: string): string {
	const date = new Date(`${dateStr}T00:00:00`);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	const todayStr = today.toISOString().split("T")[0];
	const yesterdayStr = yesterday.toISOString().split("T")[0];

	if (dateStr === todayStr) return "Today";
	if (dateStr === yesterdayStr) return "Yesterday";

	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
	});
}

export function MemoryPage({ mentraUserId }: MemoryPageProps) {
	const navigate = useNavigate();
	const result = useQuery(api.dailySummaries.getForUser, {
		mentraUserId,
		limit: 30,
	});

	if (result === undefined) {
		return (
			<div className="space-y-6">
				<h2 className="text-xl font-semibold">Memory</h2>
				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<Card key={i} className="animate-pulse">
							<CardHeader>
								<div className="h-5 bg-gray-200 rounded w-24" />
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

	// Show upgrade prompt for non-Pro users
	if (!result.isPro) {
		return (
			<div className="space-y-6">
				<h2 className="text-xl font-semibold">Memory</h2>
				<Card>
					<CardHeader>
						<CardTitle>Memory is a Pro Feature</CardTitle>
						<CardDescription>
							Upgrade to Pro to unlock your personal memory log. Your daily
							activities, conversations, and insights will be captured and
							organized here.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<a
							href="/settings"
							className="inline-flex items-center justify-center rounded-base border-2 border-main bg-main px-4 py-2 text-sm font-medium text-white shadow-light transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
						>
							Upgrade to Pro
						</a>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (result.summaries.length === 0) {
		return (
			<div className="space-y-6">
				<h2 className="text-xl font-semibold">Memory</h2>
				<Card>
					<CardHeader>
						<CardTitle>No memories yet</CardTitle>
						<CardDescription>
							Start using your glasses and your daily activities will appear
							here as a memory log.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<h2 className="text-xl font-semibold">Memory</h2>

			<div className="space-y-4">
				{result.summaries.map((day) => (
					<Card
						key={day.date}
						className="cursor-pointer"
						onClick={() => navigate(`/memory/chat/${day.date}`)}
					>
						<CardHeader className="pb-2">
							<CardTitle className="text-lg flex items-center gap-2">
								<span>📅</span>
								{formatDate(day.date)}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<p className="text-foreground">{day.summary}</p>

							{day.topics.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{day.topics.map((topic) => (
										<span
											key={topic}
											className="px-2 py-1 bg-main/10 text-main rounded-base text-sm border border-main/20"
										>
											{topic}
										</span>
									))}
								</div>
							)}

							<p className="text-xs text-foreground/50">
								{day.sessionCount} session{day.sessionCount > 1 ? "s" : ""}
							</p>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
