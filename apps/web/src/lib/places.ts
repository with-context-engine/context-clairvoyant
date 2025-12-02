import type {
	AutocompleteResponse,
	ConvexLocation,
	LatLng,
	PlacePrediction,
} from "../types/places";

const PLACES_API_BASE = "https://places.googleapis.com/v1";
const GEOCODING_API_BASE = "https://maps.googleapis.com/maps/api/geocode/json";

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

// Geocoding API response types
interface GeocodingResult {
	geometry: {
		location: {
			lat: number;
			lng: number;
		};
	};
}

interface GeocodingResponse {
	status: string;
	results: GeocodingResult[];
}

/**
 * Fetches coordinates for a place using the Geocoding API with place_id
 * This works from the browser unlike the Places Details API
 */
export async function fetchPlaceCoordinates(
	placeId: string,
	apiKey: string,
): Promise<LatLng> {
	const url = new URL(GEOCODING_API_BASE);
	url.searchParams.set("place_id", placeId);
	url.searchParams.set("key", apiKey);

	const response = await fetch(url.toString(), {
		method: "GET",
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Geocoding API error: ${response.status} ${errorText}`);
	}

	const data = (await response.json()) as GeocodingResponse;

	if (data.status !== "OK" || !data.results || data.results.length === 0) {
		throw new Error(`Geocoding failed with status: ${data.status}`);
	}

	const location = data.results[0]?.geometry?.location;

	if (!location) {
		throw new Error("Geocoding response missing location data");
	}

	// Validate coordinate types
	if (
		typeof location.lat !== "number" ||
		typeof location.lng !== "number" ||
		Number.isNaN(location.lat) ||
		Number.isNaN(location.lng)
	) {
		throw new Error("Invalid coordinate values in geocoding response");
	}

	// Convert to our LatLng format (latitude/longitude)
	return {
		latitude: location.lat,
		longitude: location.lng,
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
