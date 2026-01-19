import { ToolUsageChart } from "./charts/ToolUsageChart";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";

interface UsagePageProps {
	mentraUserId: string;
}

export function UsagePage({ mentraUserId }: UsagePageProps) {
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
						mentraUserId={mentraUserId}
						defaultTimeframe={7}
						showControls={true}
						showSummary={true}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
