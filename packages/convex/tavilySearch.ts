"use node";

import { tavily } from "@tavily/core";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const performWebSearch = internalAction({
	args: {
		query: v.string(),
		maxResults: v.optional(v.number()),
	},
	handler: async (
		_,
		{ query, maxResults },
	): Promise<Array<{ title: string; content: string; url: string }>> => {
		try {
			const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
			const response = await client.search(query, {
				maxResults: maxResults ?? 5,
				topic: "general",
			});

			return response.results.map((result) => ({
				title: result.title,
				content: result.content,
				url: result.url,
			}));
		} catch (error) {
			console.warn("Tavily search failed:", error);
			return [];
		}
	},
});
