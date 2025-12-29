import { useState } from "react";
import { Button } from "./ui/button";

type GapSpeed = "short" | "medium" | "long";

interface MessageSpeedSelectorProps {
	value: GapSpeed;
	onSave: (speed: GapSpeed) => Promise<void>;
}

const SPEED_OPTIONS: { value: GapSpeed; label: string; description: string }[] =
	[
		{ value: "short", label: "Fast", description: "1s" },
		{ value: "medium", label: "Normal", description: "3.5s" },
		{ value: "long", label: "Slow", description: "5s" },
	];

export function MessageSpeedSelector({
	value,
	onSave,
}: MessageSpeedSelectorProps) {
	const [isSaving, setIsSaving] = useState(false);

	const handleSelect = async (speed: GapSpeed) => {
		if (speed === value) return;
		setIsSaving(true);
		try {
			await onSave(speed);
		} catch (error) {
			console.error("Failed to save message speed:", error);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<span className="text-sm font-semibold text-center">
				Gap Between Messages{" "}
				{isSaving && <span className="text-foreground/60">(Saving...)</span>}
			</span>
			<div className="flex items-center justify-center gap-2">
				{SPEED_OPTIONS.map((option) => (
					<Button
						key={option.value}
						variant={value === option.value ? "default" : "neutral"}
						size="sm"
						onClick={() => handleSelect(option.value)}
						disabled={isSaving}
						className="flex-1"
					>
						{option.label} ({option.description})
					</Button>
				))}
			</div>
		</div>
	);
}
