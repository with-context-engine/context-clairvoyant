import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

const DEFAULT_PREFIX_ORDER = ["W", "K", "S", "M", "H", "R", "N", "F"];

const PREFIX_COLORS: Record<
	string,
	{ bg: string; text: string; label: string }
> = {
	W: { bg: "bg-blue-100", text: "text-blue-700", label: "Weather" },
	M: { bg: "bg-purple-100", text: "text-purple-700", label: "Memory" },
	S: { bg: "bg-green-100", text: "text-green-700", label: "Search" },
	R: { bg: "bg-orange-100", text: "text-orange-700", label: "Recall" },
	H: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Hints" },
	K: { bg: "bg-cyan-100", text: "text-cyan-700", label: "Knowledge" },
	N: { bg: "bg-pink-100", text: "text-pink-700", label: "Note" },
	F: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Follow-up" },
};

interface PrefixPriorityEditorProps {
	value: string[];
	onSave: (priorities: string[]) => Promise<void>;
}

export function PrefixPriorityEditor({
	value,
	onSave,
}: PrefixPriorityEditorProps) {
	const [order, setOrder] = useState<string[]>(() => {
		const validPrefixes = value.filter((p) => PREFIX_COLORS[p]);
		const missingPrefixes = DEFAULT_PREFIX_ORDER.filter(
			(p) => !validPrefixes.includes(p),
		);
		return [...validPrefixes, ...missingPrefixes];
	});
	const [isSaving, setIsSaving] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);

	const moveUp = (index: number) => {
		if (index === 0) return;
		const newOrder = [...order];
		const prev = newOrder[index - 1];
		const curr = newOrder[index];
		if (prev !== undefined && curr !== undefined) {
			newOrder[index - 1] = curr;
			newOrder[index] = prev;
		}
		setOrder(newOrder);
		setHasChanges(true);
	};

	const moveDown = (index: number) => {
		if (index === order.length - 1) return;
		const newOrder = [...order];
		const curr = newOrder[index];
		const next = newOrder[index + 1];
		if (curr !== undefined && next !== undefined) {
			newOrder[index] = next;
			newOrder[index + 1] = curr;
		}
		setOrder(newOrder);
		setHasChanges(true);
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await onSave(order);
			setHasChanges(false);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-3">
			<div className="space-y-2">
				{order.map((prefix, index) => {
					const config = PREFIX_COLORS[prefix];
					if (!config) return null;

					return (
						<div
							key={prefix}
							className="flex items-center gap-3 p-3 bg-background border border-border rounded-base"
						>
							<div className="flex items-center gap-2 text-foreground/40">
								<GripVertical className="w-4 h-4" />
								<span className="text-sm font-mono w-4">{index + 1}</span>
							</div>

							<div
								className={`px-2 py-1 rounded-base font-mono text-sm ${config.bg} ${config.text}`}
							>
								{prefix}
							</div>

							<span className="flex-1 text-sm">{config.label}</span>

							<div className="flex gap-1">
								<button
									type="button"
									onClick={() => moveUp(index)}
									disabled={index === 0}
									className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
									aria-label={`Move ${config.label} up`}
								>
									<ChevronUp className="w-4 h-4" />
								</button>
								<button
									type="button"
									onClick={() => moveDown(index)}
									disabled={index === order.length - 1}
									className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
									aria-label={`Move ${config.label} down`}
								>
									<ChevronDown className="w-4 h-4" />
								</button>
							</div>
						</div>
					);
				})}
			</div>

			{hasChanges && (
				<Button onClick={handleSave} disabled={isSaving} className="w-full">
					{isSaving ? "Saving..." : "Save Priority Order"}
				</Button>
			)}
		</div>
	);
}

export { DEFAULT_PREFIX_ORDER };
