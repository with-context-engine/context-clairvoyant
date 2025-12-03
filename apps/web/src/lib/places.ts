import type {
	AutocompleteResponse,
	ConvexLocation,
	LatLng,
	PlacePrediction,
} from "../types/places";

const PLACES_API_BASE = "https://places.googleapis.com/v1";

/**
 * Fetches autocomplete suggestions from Google Places API
 */
export async function fetchAutocompleteSuggestions(
	input: string,
	apiKey: string,
	sessionToken?: string,
	locationBias?: ConvexLocation,
): Promise<PlacePrediction[]> {
	const url = `${PLACES_API_BASE}/places:autocomplete`;

	const body: {
		input: string;
		sessionToken?: string;
		locationBias?: {
			circle: {
				center: { latitude: number; longitude: number };
				radius: number;
			};
		};
	} = {
		input,
	};

	if (sessionToken) {
		body.sessionToken = sessionToken;
	}

	if (locationBias) {
		body.locationBias = {
			circle: {
				center: {
					latitude: locationBias.lat,
					longitude: locationBias.lng,
				},
				radius: 50000, // 50km radius
			},
		};
	}

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Goog-Api-Key": apiKey,
			"X-Goog-FieldMask": "suggestions.placePrediction",
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Places Autocomplete API error: ${response.status} ${errorText}`,
		);
	}

	const data = (await response.json()) as AutocompleteResponse;

	// Validate response structure
	if (!data.suggestions || !Array.isArray(data.suggestions)) {
		return [];
	}

	// Extract only place predictions (filter out query predictions)
	const predictions = data.suggestions
		.map((suggestion) => suggestion.placePrediction)
		.filter((prediction): prediction is PlacePrediction => {
			if (!prediction) return false;
			// Validate required fields
			return (
				typeof prediction.place === "string" &&
				typeof prediction.placeId === "string" &&
				prediction.text &&
				typeof prediction.text.text === "string"
			);
		});

	return predictions;
}

// Places API (New) Place Details response types
interface PlaceDetailsResponse {
	location?: {
		latitude: number;
		longitude: number;
	};
	displayName?: {
		text: string;
		languageCode?: string;
	};
}

/**
 * Fetches coordinates for a place using the Places API (New) Place Details
 * Uses POST request which has better CORS support than GET
 */
export async function fetchPlaceCoordinates(
	placeId: string,
	apiKey: string,
): Promise<LatLng> {
	// The Places API (New) uses the resource name format
	const resourceName = placeId.startsWith("places/")
		? placeId
		: `places/${placeId}`;
	const url = `${PLACES_API_BASE}/${resourceName}`;

	const response = await fetch(url, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			"X-Goog-Api-Key": apiKey,
			"X-Goog-FieldMask": "location,displayName",
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Places Details API error: ${response.status} ${errorText}`,
		);
	}

	const data = (await response.json()) as PlaceDetailsResponse;

	if (!data.location) {
		throw new Error("Place details response missing location data");
	}

	const location = data.location;

	// Validate coordinate types
	if (
		typeof location.latitude !== "number" ||
		typeof location.longitude !== "number" ||
		Number.isNaN(location.latitude) ||
		Number.isNaN(location.longitude)
	) {
		throw new Error("Invalid coordinate values in place details response");
	}

	return {
		latitude: location.latitude,
		longitude: location.longitude,
	};
}

/**
 * Converts Google API LatLng format to Convex storage format
 */
export function toConvexLocation(location: LatLng): ConvexLocation {
	return {
		lat: location.latitude,
		lng: location.longitude,
	};
}

/**
 * Parses a Convex location JSON string to ConvexLocation object
 */
export function parseConvexLocation(
	locationString: string | undefined,
): ConvexLocation | null {
	if (!locationString) {
		return null;
	}

	try {
		const location = JSON.parse(locationString) as {
			lat?: number;
			lng?: number;
		};

		if (
			typeof location.lat !== "number" ||
			typeof location.lng !== "number" ||
			Number.isNaN(location.lat) ||
			Number.isNaN(location.lng)
		) {
			console.warn("Invalid defaultLocation format:", locationString);
			return null;
		}

		return { lat: location.lat, lng: location.lng };
	} catch (error) {
		console.error("Failed to parse location string:", error);
		return null;
	}
}

/**
 * Generates a session token for Places API calls
 */
export function generateSessionToken(): string {
	return crypto.randomUUID();
}
