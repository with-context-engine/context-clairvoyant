import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ToolUsageChart } from "./charts/ToolUsageChart";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { WeatherUnitToggle } from "./WeatherUnitToggle";

export function SettingsPage({ userId }: { userId: Id<"users"> }) {
	const preferences = useQuery(api.preferences.getPreferences, { userId });
	const updatePreferences = useMutation(api.preferences.updatePreferences);

	const handleSaveUnit = async (unit: "C" | "F") => {
		await updatePreferences({
			userId,
			weatherUnit: unit,
		});
		console.log(`Preference saved: weatherUnit=${unit}`);
	};

	if (preferences === undefined) {
		return (
			<div>
				<h2>Settings</h2>
				<p>Loading preferences...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<h2>Settings</h2>

			<Card>
				<CardContent>
					<WeatherUnitToggle
						value={preferences.weatherUnit as "C" | "F"}
						onSave={handleSaveUnit}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Tool usage</CardTitle>
					<CardDescription>
						Track how often each tool is invoked over time.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ToolUsageChart userId={userId} />
				</CardContent>
			</Card>
		</div>
	);
}
