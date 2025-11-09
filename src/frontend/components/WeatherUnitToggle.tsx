interface WeatherUnitToggleProps {
	value: "C" | "F";
	onChange: (unit: "C" | "F") => void;
	disabled?: boolean;
}

export function WeatherUnitToggle({
	value,
	onChange,
	disabled = false,
}: WeatherUnitToggleProps) {
	return (
		<div className="inline-flex items-center gap-2">
			<span className="text-sm font-medium text-gray-700">Weather Unit:</span>
			<fieldset className="inline-flex rounded-md shadow-sm">
				<button
					type="button"
					onClick={() => onChange("C")}
					disabled={disabled}
					className={`px-4 py-2 text-sm font-medium border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
						value === "C"
							? "bg-blue-500 text-white border-blue-500"
							: "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
					} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
					aria-label="Select Celsius"
					aria-pressed={value === "C"}
				>
					Celsius (°C)
				</button>
				<button
					type="button"
					onClick={() => onChange("F")}
					disabled={disabled}
					className={`px-4 py-2 text-sm font-medium border rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
						value === "F"
							? "bg-blue-500 text-white border-blue-500"
							: "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
					} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
					aria-label="Select Fahrenheit"
					aria-pressed={value === "F"}
				>
					Fahrenheit (°F)
				</button>
			</fieldset>
		</div>
	);
}
