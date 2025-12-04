// Google Places Autocomplete API Response Types

export interface StringRange {
	startOffset?: number;
	endOffset: number;
}

export interface FormattableText {
	text: string;
	matches?: StringRange[];
}

export interface PlacePrediction {
	place: string; // Resource name like "places/ChIJ..."
	placeId: string; // Short ID like "ChIJ..."
	text: FormattableText;
	structuredFormat?: {
		mainText: FormattableText;
		secondaryText: FormattableText;
	};
	types?: string[];
	distanceMeters?: number;
}

export interface QueryPrediction {
	text: FormattableText;
	structuredFormat?: {
		mainText: FormattableText;
		secondaryText: FormattableText;
	};
}

export interface AutocompleteSuggestion {
	placePrediction?: PlacePrediction;
	queryPrediction?: QueryPrediction;
}

export interface AutocompleteResponse {
	suggestions: AutocompleteSuggestion[];
}

// Google Places Details API Response Types

export interface LatLng {
	latitude: number;
	longitude: number;
}

export interface PlaceDisplayName {
	text: string;
	languageCode?: string;
}

export interface PlaceDetails {
	id: string;
	displayName: PlaceDisplayName;
	formattedAddress?: string;
	location?: LatLng;
}

// Convex location format (stored as JSON string)
export interface ConvexLocation {
	lat: number;
	lng: number;
}
