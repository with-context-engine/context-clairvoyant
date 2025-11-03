import { tavily } from "@tavily/core";
import type { z } from "zod";
import { env } from "../core/env";
import { webSearchSchema } from "../types/schema";

const client = tavily({
	apiKey: env.TAVILY_API_KEY,
});

export async function performWebSearch(
	query: string,
): Promise<z.infer<typeof webSearchSchema>[]> {
	const result = await client.search(query, {
		maxResults: 10,
		timeRange: "month",
		topic: "news",
	});
	return result.results.map((result) =>
		webSearchSchema.parse({
			title: result.title,
			content: result.content,
		}),
	);
}
