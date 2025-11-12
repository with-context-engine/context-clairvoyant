import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { SubscriptionCard } from "./SubscriptionCard";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { WeatherUnitToggle } from "./WeatherUnitToggle";

type SettingsSection = "root" | "preferences" | "billing";

interface SettingsPageProps {
	userId: Id<"users">;
	mentraUserId?: string | null;
}

export function SettingsPage({ userId, mentraUserId }: SettingsPageProps) {
	const [section, setSection] = useState<SettingsSection>("root");
	const preferences = useQuery(api.preferences.getPreferences, { userId });
	const updatePreferences = useMutation(api.preferences.updatePreferences);

	const handleSaveUnit = async (unit: "C" | "F") => {
		await updatePreferences({
			userId,
			weatherUnit: unit,
		});
		console.log(`Preference saved: weatherUnit=${unit}`);
	};

	const hasPreferencesLoaded = preferences !== undefined;
	const weatherUnit = useMemo(() => {
		if (!preferences) {
			return "C";
		}
		return (preferences.weatherUnit as "C" | "F") ?? "C";
	}, [preferences]);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				{section !== "root" && (
					<Button
						variant="neutral"
						size="sm"
						onClick={() => setSection("root")}
					>
						← Back
					</Button>
				)}
				<h2 className="text-xl font-semibold">Settings</h2>
			</div>

			{section === "root" && (
				<div className="space-y-4">
					<button
						type="button"
						onClick={() => setSection("preferences")}
						className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-main rounded-base"
					>
						<Card className="hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-shadow transition-all">
							<CardHeader>
								<CardTitle>Preferences</CardTitle>
								<CardDescription>
									Weather units and other personal settings
								</CardDescription>
							</CardHeader>
						</Card>
					</button>

					<button
						type="button"
						onClick={() => setSection("billing")}
						className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-main rounded-base"
					>
						<Card className="hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-shadow transition-all">
							<CardHeader>
								<CardTitle>Billing</CardTitle>
								<CardDescription>
									Subscription status and plan management
								</CardDescription>
							</CardHeader>
						</Card>
					</button>
				</div>
			)}

			{section === "preferences" && (
				<Card>
					<CardHeader>
						<CardTitle>Weather Unit</CardTitle>
						<CardDescription>
							Choose how temperatures are displayed
						</CardDescription>
					</CardHeader>
					<CardContent>
						{!hasPreferencesLoaded ? (
							<p className="text-sm text-foreground/60">
								Loading preferences...
							</p>
						) : (
							<WeatherUnitToggle value={weatherUnit} onSave={handleSaveUnit} />
						)}
					</CardContent>
				</Card>
			)}

			{section === "billing" && (
				<Card>
					<CardHeader>
						<CardTitle>Subscription</CardTitle>
						<CardDescription>
							Manage your Clairvoyant subscription
						</CardDescription>
					</CardHeader>
					<CardContent>
						{mentraUserId ? (
							<SubscriptionCard mentraUserId={mentraUserId} />
						) : (
							<p className="text-sm text-foreground/60">
								Billing is unavailable because the Mentra user ID could not be
								loaded.
							</p>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
