import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis } from "recharts";
import { cn } from "@/lib/utils";
import type { ChartConfig } from "../ui/chart";
import { ChartContainer } from "../ui/chart";

type Timeframe = 1 | 7 | 30;

type ToolUsageChartProps = {
	userId: Id<"users">;
	className?: string;
	defaultTimeframe?: Timeframe;
	timeframes?: Timeframe[];
	showControls?: boolean;
	showSummary?: boolean;
	loadingText?: string;
	emptyText?: string;
};

const DEFAULT_TIMEFRAMES: Timeframe[] = [1, 7, 30];

const ROUTER_STYLES: Record<
	string,
	{ key: string; label: string; color: string }
> = {
	WEATHER: { key: "weather", label: "Weather", color: "var(--chart-1)" },
	MAPS: { key: "maps", label: "Maps", color: "var(--chart-2)" },
	WEB_SEARCH: {
		key: "webSearch",
		label: "Web Search",
		color: "var(--chart-3)",
	},
	MEMORY_RECALL: {
		key: "memoryRecall",
		label: "Memory Recall",
		color: "var(--chart-5)",
	},
};

const FALLBACK_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--chart-6)",
];

export function ToolUsageChart({
	userId,
	className,
	defaultTimeframe,
	timeframes = DEFAULT_TIMEFRAMES,
	showControls = true,
	showSummary = true,
	loadingText = "Loading usage…",
	emptyText = "No tool activity recorded for this range yet.",
}: ToolUsageChartProps) {
	const timelineOptions =
		timeframes.length > 0 ? timeframes : DEFAULT_TIMEFRAMES;

	const initialTimeframe =
		defaultTimeframe && timelineOptions.includes(defaultTimeframe)
			? defaultTimeframe
			: timelineOptions[0];

	const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe ?? 7);

	const toolInvocations = useQuery(api.toolInvocations.getUserToolInvocations, {
		userId,
		days: timeframe,
	});

	const chartMemo = useMemo(() => {
		if (!toolInvocations || !toolInvocations.length) {
			return {
				config: {} as ChartConfig,
				data: [] as Array<Record<string, number | string>>,
				keys: [] as string[],
				total: 0,
			};
		}

		// Filter out KNOWLEDGE entries
		const filteredInvocations = toolInvocations.filter(
			({ router }) => router !== "KNOWLEDGE",
		);

		if (!filteredInvocations.length) {
			return {
				config: {} as ChartConfig,
				data: [] as Array<Record<string, number | string>>,
				keys: [] as string[],
				total: 0,
			};
		}

		const routerOrder: string[] = [];
		const routerKeyMap = new Map<string, string>();
		const configEntries: Array<[string, { label: string; color: string }]> = [];

		filteredInvocations.forEach(({ router }) => {
			if (!routerOrder.includes(router)) {
				routerOrder.push(router);
			}
		});

		routerOrder.forEach((router, index) => {
			const preset = ROUTER_STYLES[router];
			const key = preset?.key ?? router.toLowerCase();
			const label =
				preset?.label ??
				router
					.toLowerCase()
					.split("_")
					.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
					.join(" ");
			const color =
				preset?.color ??
				FALLBACK_COLORS[index % FALLBACK_COLORS.length] ??
				"var(--chart-1)";

			routerKeyMap.set(router, key);
			configEntries.push([key, { label, color }]);
		});

		const dataByDate = new Map<string, Record<string, number | string>>();
		let total = 0;

		filteredInvocations.forEach(({ date, router, count }) => {
			const key = routerKeyMap.get(router);
			if (!key) return;

			total += count;
			let row = dataByDate.get(date);
			if (!row) {
				row = { date };
				dataByDate.set(date, row);
			}

			row[key] = count;
		});

		const keys = configEntries.map(([key]) => key);

		const sortedData = Array.from(dataByDate.values()).sort((a, b) =>
			String(a.date).localeCompare(String(b.date)),
		);

		sortedData.forEach((row) => {
			keys.forEach((key) => {
				if (row[key] === undefined) {
					row[key] = 0;
				}
			});
		});

		return {
			config: Object.fromEntries(configEntries) as ChartConfig,
			data: sortedData,
			keys,
			total,
		};
	}, [toolInvocations]);

	const isChartLoading = toolInvocations === undefined;

	return (
		<div className={cn("space-y-4", className)}>
			{showControls && (
				<div className="flex flex-wrap gap-2">
					{timelineOptions.map((option) => (
						<button
							type="button"
							key={option}
							onClick={() => setTimeframe(option)}
							className={cn(
								"rounded-md border px-3 py-1.5 text-sm transition-colors",
								option === timeframe
									? "border-primary bg-primary text-primary-foreground"
									: "border-border bg-secondary-background hover:bg-muted",
							)}
						>
							{option === 1 ? "1 day" : `${option} days`}
						</button>
					))}
				</div>
			)}

			<div className="w-full">
				{isChartLoading ? (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						{loadingText}
					</div>
				) : chartMemo.data.length === 0 ? (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						{emptyText}
					</div>
				) : (
					<ChartContainer config={chartMemo.config}>
						<BarChart
							data={chartMemo.data}
							margin={{ left: 12, right: 12, top: 12, bottom: 12 }}
							barCategoryGap="20%"
						>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="date"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								tickFormatter={(value: string) =>
									new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
										month: "short",
										day: "numeric",
									})
								}
							/>
							<Tooltip
								cursor={{ fill: "rgba(255,255,255,0.12)" }}
								labelFormatter={(value: string) =>
									new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
										weekday: "short",
										month: "short",
										day: "numeric",
									})
								}
								formatter={(value, name) => [
									Number(value).toLocaleString(),
									chartMemo.config[name as string]?.label ?? name,
								]}
							/>
							{chartMemo.keys.map((key) => (
								<Bar
									key={key}
									dataKey={key}
									stackId="total"
									fill={`var(--color-${key})`}
									radius={[4, 4, 0, 0]}
									isAnimationActive={false}
								/>
							))}
						</BarChart>
					</ChartContainer>
				)}
			</div>

			{showSummary && chartMemo.total > 0 && (
				<p className="text-center text-sm text-muted-foreground">
					<span className="font-medium text-foreground">
						{chartMemo.total.toLocaleString()}
					</span>{" "}
					tool invocations across the last {timeframe} day
					{timeframe > 1 ? "s" : ""}.
				</p>
			)}
		</div>
	);
}
