import type { z } from "zod";
import { env } from "../core/env";
import { mapSearchSchema } from "../types/schema";

type MapSearchResult = z.infer<typeof mapSearchSchema>;

export interface PlaceSuggestion {
	id: string;
	name: string;
	address: string;
	snippet?: string;
}

export async function getPlaces(
	query: string,
	location: {
		latitude: number;
		longitude: number;
	},
): Promise<PlaceSuggestion[]> {
	const response = await fetch(
		"https://places.googleapis.com/v1/places:searchText",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
				"X-Goog-FieldMask":
					"places.displayName,places.shortFormattedAddress,places.id,places.reviewSummary.text.text",
			},
			body: JSON.stringify({
				textQuery: query,
				openNow: true,
				languageCode: "en",
				includePureServiceAreaBusinesses: false,
				pageSize: 5,
				locationBias: {
					circle: {
						center: {
							latitude: location.latitude,
							longitude: location.longitude,
						},
						radius: 10,
					},
				},
			}),
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`HTTP ${response.status}: ${errorText}`);
	}

	const data = (await response.json()) as {
		places: google.maps.places.PlaceResult[];
	};

	const validatedPlaces =
		data.places?.map((place) => {
			try {
				return mapSearchSchema.parse(place);
			} catch (error) {
				console.error("Schema validation failed for place:", place, error);
				throw new Error(`Invalid place data format: ${error}`);
			}
		}) || [];

	return validatedPlaces.map((place: MapSearchResult): PlaceSuggestion => ({
		id: place.id,
		name: place.displayName.text,
		address: place.shortFormattedAddress,
		snippet: place.reviewSummary?.text?.text,
	}));
}
