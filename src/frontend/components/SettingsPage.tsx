import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { WeatherUnitToggle } from "./WeatherUnitToggle";

export function SettingsPage({ userId }: { userId: Id<"users"> }) {
	const preferences = useQuery(api.preferences.getPreferences, { userId });
	const updatePreferences = useMutation(api.preferences.updatePreferences);

	const [localUnit, setLocalUnit] = useState<"C" | "F">("C");
	const [hasChanges, setHasChanges] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);

	useEffect(() => {
		if (preferences !== undefined) {
			setLocalUnit(preferences.weatherUnit as "C" | "F");
			setHasChanges(false);
		}
	}, [preferences]);

	const handleToggleChange = (unit: "C" | "F") => {
		setLocalUnit(unit);
		setHasChanges(preferences?.weatherUnit !== unit);
		setSaveMessage(null);
	};

	const handleSave = async () => {
		setIsSaving(true);
		setSaveMessage(null);
		try {
			await updatePreferences({
				userId,
				weatherUnit: localUnit,
			});
			setSaveMessage("✓ Preferences saved successfully!");
			setHasChanges(false);
			console.log(`Preference saved: weatherUnit=${localUnit}`);
		} catch (error) {
			setSaveMessage("✗ Failed to save preferences. Please try again.");
			console.error("Failed to save preferences:", error);
		} finally {
			setIsSaving(false);
		}
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
		<div>
			<h2>Settings</h2>

			<div className="mt-6 p-5 border-2 border-gray-200 rounded-lg bg-gray-50">
				<h3 className="mt-0">Weather Preferences</h3>

				<div className="mb-4">
					<WeatherUnitToggle
						value={localUnit}
						onChange={handleToggleChange}
						disabled={isSaving}
					/>
				</div>

				<button
					type="button"
					onClick={handleSave}
					disabled={!hasChanges || isSaving}
					className={`px-5 py-2.5 rounded-md text-sm font-semibold transition-colors ${
						hasChanges && !isSaving
							? "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
							: "bg-gray-300 text-gray-500 cursor-not-allowed"
					}`}
				>
					{isSaving ? "Saving..." : "Save Preferences"}
				</button>

				{saveMessage && (
					<div
						className={`mt-3 p-3 rounded-md text-sm ${
							saveMessage.startsWith("✓")
								? "bg-green-100 text-green-800"
								: "bg-red-100 text-red-800"
						}`}
					>
						{saveMessage}
					</div>
				)}
			</div>
		</div>
	);
}
