import { z } from "zod";

const schema = z.object({
	VITE_CONVEX_URL: z.string(),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
	const issues = parsed.error.issues
		.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
		.join("; ");
	throw new Error(`Invalid frontend environment variables: ${issues}`);
}

export const convexUrl = parsed.data.VITE_CONVEX_URL;
