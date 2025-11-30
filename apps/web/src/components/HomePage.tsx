import type { Id } from "@convex/_generated/dataModel";
import ClairvoyantMobile from "./Clairvoyant";
import { ToolUsageChart } from "./charts/ToolUsageChart";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";

export function HomePage({ userId }: { userId: Id<"users"> }) {
	return (
		<div className="space-y-2 overflow-x-hidden">
			<div className="flex items-center justify-center overflow-hidden">
				<div className="scale-75 origin-center">
					<ClairvoyantMobile />
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Features</CardTitle>
				</CardHeader>
				<CardContent>
					<ul className="space-y-2">
						<li className="flex items-start gap-2">
							<span className="text-main">●</span>
							<span>Real-time weather information</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-main">●</span>
							<span>Web search capabilities</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-main">●</span>
							<span>Location-based services</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-main">●</span>
							<span>Personalized preferences</span>
						</li>
					</ul>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Recent tool usage</CardTitle>
					<CardDescription>
						See what you’ve used most this week.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ToolUsageChart
						userId={userId}
						defaultTimeframe={7}
						showControls={false}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
