import { z } from "zod";

const schema = z.object({
	VITE_CONVEX_URL: z.string(),
	VITE_API_BASE_URL: z.string().optional(),
	VITE_MAPBOX_ACCESS_TOKEN: z.string(),
	VITE_GOOGLE_MAPS_API_KEY: z.string(),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
	const issues = parsed.error.issues
		.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
		.join("; ");
	throw new Error(`Invalid frontend environment variables: ${issues}`);
}

export const convexUrl = parsed.data.VITE_CONVEX_URL;
export const apiBaseUrl = parsed.data.VITE_API_BASE_URL ?? "/";
export const mapboxAccessToken = parsed.data.VITE_MAPBOX_ACCESS_TOKEN;
export const googleMapsApiKey = parsed.data.VITE_GOOGLE_MAPS_API_KEY;
