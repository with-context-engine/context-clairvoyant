import { describe, expect, test } from "bun:test";
import { env } from "../src/application/core/env";

const samplePayload = {
	places: [
		{
			id: "place-1",
			displayName: {
				text: "Thai Spice",
				languageCode: "en",
			},
			shortFormattedAddress: "123 Main St",
			reviewSummary: {
				text: {
					text: "Loved for creamy Thai iced tea and curries",
				},
			},
		},
		{
			id: "place-2",
			displayName: {
				text: "Bangkok Bites",
			},
			shortFormattedAddress: "45 Elm Ave",
		},
	],
};

describe("Maps API Integration", () => {
	test("getPlaces formats Google Places results", async () => {
		// Initialize environment variables through env.ts
		process.env.GOOGLE_MAPS_API_KEY ??= "test-key";
		process.env.PACKAGE_NAME ??= "test-package";
		process.env.PORT ??= "3000";
		process.env.MENTRAOS_API_KEY ??= "test-mentra-key";
		process.env.GROQ_API_KEY ??= "test-groq-key";
		process.env.OPENAI_API_KEY ??= "test-openai-key";
		process.env.OPENWEATHERMAP_API_KEY ??= "test-weather-key";
		process.env.TAVILY_API_KEY ??= "test-tavily-key";

		// Ensure env is initialized
		env;
		const originalFetch = globalThis.fetch;
		globalThis.fetch = Object.assign(
			async () =>
				new Response(JSON.stringify(samplePayload), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			{ preconnect: () => Promise.resolve() },
		);

		try {
			const { getPlaces } = await import("../src/application/tools/mapsCall");
			const places = await getPlaces("Thai iced tea", {
				latitude: 40.7507,
				longitude: -73.9819,
			});

			expect(places).toHaveLength(2);
			expect(places[0]).toEqual({
				id: "place-1",
				name: "Thai Spice",
				address: "123 Main St",
				snippet: "Loved for creamy Thai iced tea and curries",
			});
			expect(places[1]).toEqual({
				id: "place-2",
				name: "Bangkok Bites",
				address: "45 Elm Ave",
				snippet: undefined,
			});
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("getPlaces throws on failed HTTP response", async () => {
		// Initialize environment variables through env.ts
		process.env.GOOGLE_MAPS_API_KEY ??= "test-key";
		process.env.PACKAGE_NAME ??= "test-package";
		process.env.PORT ??= "3000";
		process.env.MENTRAOS_API_KEY ??= "test-mentra-key";
		process.env.GROQ_API_KEY ??= "test-groq-key";
		process.env.OPENAI_API_KEY ??= "test-openai-key";
		process.env.OPENWEATHERMAP_API_KEY ??= "test-weather-key";
		process.env.TAVILY_API_KEY ??= "test-tavily-key";

		// Ensure env is initialized
		env;
		const originalFetch = globalThis.fetch;
		globalThis.fetch = Object.assign(
			async () =>
				new Response("Boom", {
					status: 500,
					statusText: "Internal Server Error",
				}),
			{ preconnect: () => Promise.resolve() },
		);

		try {
			const { getPlaces } = await import("../src/application/tools/mapsCall");
			expect(
				getPlaces("anything", { latitude: 0, longitude: 0 }),
			).rejects.toThrow(/HTTP 500/);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
