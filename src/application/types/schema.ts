import { z } from "zod";

export const webSearchSchema = z.object({
	title: z.string(),
	content: z.string(),
});

export const mapSearchSchema = z.object({
	id: z.string(),
	displayName: z.object({
		text: z.string(),
		languageCode: z.string().optional(),
	}),
	shortFormattedAddress: z.string(),
	reviewSummary: z
		.object({
			text: z
				.object({
					text: z.string(),
				})
				.optional(),
		})
		.optional(),
});
