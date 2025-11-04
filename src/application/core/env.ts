import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		PACKAGE_NAME: z.string(),
		PORT: z.coerce.number(),
		MENTRAOS_API_KEY: z.string(),
		GROQ_API_KEY: z.string(),
		OPENAI_API_KEY: z.string(),
		OPENWEATHERMAP_API_KEY: z.string(),
		TAVILY_API_KEY: z.string(),
		GOOGLE_MAPS_API_KEY: z.string(),
		HONCHO_API_KEY: z.string(),
		CONVEX_URL: z.string(),
		CONVEX_AUTH_SECRET: z.string(),
	},
	runtimeEnv: process.env,
});
