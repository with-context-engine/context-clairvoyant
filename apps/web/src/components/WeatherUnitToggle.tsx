import { useState } from "react";
import { Switch } from "./ui/switch";

interface WeatherUnitToggleProps {
	value: "C" | "F";
	onSave: (unit: "C" | "F") => Promise<void>;
}

export function WeatherUnitToggle({
	value,
	onSave,
}: WeatherUnitToggleProps) {
	const [isSaving, setIsSaving] = useState(false);

	const handleToggle = async (checked: boolean) => {
		const newUnit = checked ? "F" : "C";
		setIsSaving(true);
		try {
			await onSave(newUnit);
		} catch (error) {
			console.error("Failed to save weather unit:", error);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<span className="text-sm font-semibold text-center">
				Weather Unit {isSaving && <span className="text-foreground/60">(Saving...)</span>}
			</span>
			<div className="flex items-center justify-between gap-4">
				<span
					className={`text-sm font-semibold transition-colors flex-1 text-right ${
						value === "C" ? "text-main" : "text-foreground/60"
					}`}
				>
					Celsius (°C)
				</span>
				<Switch
					checked={value === "F"}
					onCheckedChange={handleToggle}
					disabled={isSaving}
					aria-label="Toggle temperature unit"
				/>
				<span
					className={`text-sm font-semibold transition-colors flex-1 text-left ${
						value === "F" ? "text-main" : "text-foreground/60"
					}`}
				>
					Fahrenheit (°F)
				</span>
			</div>
		</div>
	);
}
