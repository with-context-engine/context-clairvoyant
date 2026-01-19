import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { LocationSelector } from "./LocationSelector";
import { MessageSpeedSelector } from "./MessageSpeedSelector";
import {
	DEFAULT_PREFIX_ORDER,
	PrefixPriorityEditor,
} from "./PrefixPriorityEditor";
// import { SubscriptionCard } from "./SubscriptionCard";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { WeatherUnitToggle } from "./WeatherUnitToggle";

type SettingsSection = "root" | "preferences" | "billing";

interface SettingsPageProps {
	mentraUserId: string;
}

export function SettingsPage({ mentraUserId }: SettingsPageProps) {
	const [section, setSection] = useState<SettingsSection>("root");
	const preferences = useQuery(api.users.getPreferences, { mentraUserId });
	const updatePreferences = useMutation(api.users.updatePreferences);
	const updatePrefixPriorities = useMutation(api.users.updatePrefixPriorities);
	const updateMessageGapSpeed = useMutation(api.users.updateMessageGapSpeed);

	const storedEmail = useQuery(
		api.users.getEmail,
		mentraUserId ? { mentraUserId } : "skip",
	);
	const updateEmail = useMutation(api.users.updateEmail);
	const [emailInput, setEmailInput] = useState("");
	const [emailStatus, setEmailStatus] = useState<
		"idle" | "saving" | "saved" | "error"
	>("idle");
	const [emailError, setEmailError] = useState<string | null>(null);

	useEffect(() => {
		if (storedEmail !== undefined && storedEmail !== null) {
			setEmailInput(storedEmail);
		}
	}, [storedEmail]);

	const isValidEmail = (email: string) =>
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

	const handleSaveEmail = async () => {
		if (!mentraUserId) return;
		if (!isValidEmail(emailInput)) {
			setEmailError("Please enter a valid email address");
			setEmailStatus("error");
			return;
		}
		setEmailStatus("saving");
		setEmailError(null);
		try {
			await updateEmail({ mentraUserId, email: emailInput });
			setEmailStatus("saved");
			setTimeout(() => setEmailStatus("idle"), 2000);
		} catch {
			setEmailError("Failed to save email");
			setEmailStatus("error");
		}
	};

	const handleSaveUnit = async (unit: "C" | "F") => {
		await updatePreferences({
			mentraUserId,
			weatherUnit: unit,
		});
		console.log(`Preference saved: weatherUnit=${unit}`);
	};

	const handleSavePriorities = async (priorities: string[]) => {
		await updatePrefixPriorities({
			mentraUserId,
			prefixPriorities: priorities,
		});
		console.log(`Preference saved: prefixPriorities=${priorities.join(",")}`);
	};

	const handleSaveGapSpeed = async (speed: "short" | "medium" | "long") => {
		await updateMessageGapSpeed({
			mentraUserId,
			messageGapSpeed: speed,
		});
		console.log(`Preference saved: messageGapSpeed=${speed}`);
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

					{/* Billing section commented out - payments disabled
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
					*/}
				</div>
			)}

			{section === "preferences" && (
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Email Address</CardTitle>
							<CardDescription>
								Used for receiving notes and session summaries
							</CardDescription>
						</CardHeader>
						<CardContent>
							{storedEmail === undefined ? (
								<p className="text-sm text-foreground/60">Loading...</p>
							) : (
								<div className="flex flex-col gap-3">
									<div className="flex gap-2">
										<Input
											type="email"
											placeholder="you@example.com"
											value={emailInput}
											onChange={(e) => {
												setEmailInput(e.target.value);
												setEmailStatus("idle");
												setEmailError(null);
											}}
											className="flex-1"
										/>
										<Button
											onClick={handleSaveEmail}
											disabled={emailStatus === "saving"}
										>
											{emailStatus === "saving" ? "Saving..." : "Save"}
										</Button>
									</div>
									{emailStatus === "saved" && (
										<p className="text-sm text-green-600">Email saved</p>
									)}
									{emailError && (
										<p className="text-sm text-red-600">{emailError}</p>
									)}
								</div>
							)}
						</CardContent>
					</Card>

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
								<WeatherUnitToggle
									value={weatherUnit}
									onSave={handleSaveUnit}
								/>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Your Location</CardTitle>
							<CardDescription>
								Your location is used to improve weather and nearby searches.
								This is pulled from your Mentra Glasses, from your billing
								information, or from a location you set manually.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{!hasPreferencesLoaded ? (
								<p className="text-sm text-foreground/60">
									Loading preferences...
								</p>
							) : (
								<LocationSelector mentraUserId={mentraUserId} />
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Message Priority</CardTitle>
							<CardDescription>
								Reorder which message types display first on your glasses
							</CardDescription>
						</CardHeader>
						<CardContent>
							{!hasPreferencesLoaded ? (
								<p className="text-sm text-foreground/60">
									Loading preferences...
								</p>
							) : (
								<PrefixPriorityEditor
									value={preferences?.prefixPriorities ?? DEFAULT_PREFIX_ORDER}
									onSave={handleSavePriorities}
								/>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Message Speed</CardTitle>
							<CardDescription>
								How quickly messages cycle on your glasses
							</CardDescription>
						</CardHeader>
						<CardContent>
							{!hasPreferencesLoaded ? (
								<p className="text-sm text-foreground/60">
									Loading preferences...
								</p>
							) : (
								<MessageSpeedSelector
									value={
										(preferences?.messageGapSpeed as
											| "short"
											| "medium"
											| "long") ?? "medium"
									}
									onSave={handleSaveGapSpeed}
								/>
							)}
						</CardContent>
					</Card>
				</div>
			)}

			{/* Billing section commented out - payments disabled
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
			*/}
		</div>
	);
}
