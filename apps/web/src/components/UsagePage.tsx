import type { Id } from "@convex/_generated/dataModel";
import { ToolUsageChart } from "./charts/ToolUsageChart";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";

interface UsagePageProps {
	userId: Id<"users">;
}

export function UsagePage({ userId }: UsagePageProps) {
	return (
		<div className="space-y-6">
			<h2 className="text-xl font-semibold">Usage</h2>

			<Card>
				<CardHeader>
					<CardTitle>Tool Usage</CardTitle>
					<CardDescription>
						See how you've been using Clairvoyant over time.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ToolUsageChart
						userId={userId}
						defaultTimeframe={7}
						showControls={true}
						showSummary={true}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
