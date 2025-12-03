import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { MapPin, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map as MapboxMap, Marker } from "react-map-gl/mapbox";
import { googleMapsApiKey, mapboxAccessToken } from "../env";
import {
	fetchAutocompleteSuggestions,
	fetchPlaceCoordinates,
	generateSessionToken,
	parseConvexLocation,
	toConvexLocation,
} from "../lib/places";
import type { PlacePrediction } from "../types/places";

import "mapbox-gl/dist/mapbox-gl.css";

interface LocationSelectorProps {
	userId: Id<"users">;
}

export function LocationSelector({ userId }: LocationSelectorProps) {
	const preferences = useQuery(api.users.getPreferences, { userId });
	const setCurrentLocation = useMutation(api.users.setCurrentLocation);

	// Parse the stored location
	const currentLocation = useMemo(() => {
		return parseConvexLocation(preferences?.defaultLocation);
	}, [preferences?.defaultLocation]);

	// Map viewport state
	const [viewState, setViewState] = useState({
		longitude: currentLocation?.lng ?? 0,
		latitude: currentLocation?.lat ?? 0,
		zoom: currentLocation ? 12 : 1,
	});

	// Update viewport when location changes from Convex
	useEffect(() => {
		if (currentLocation) {
			setViewState({
				longitude: currentLocation.lng,
				latitude: currentLocation.lat,
				zoom: 12,
			});
		}
	}, [currentLocation]);

	// Autocomplete state
	const [inputValue, setInputValue] = useState("");
	const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
	const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showSuggestions, setShowSuggestions] = useState(false);

	// Session token for Places API (persists across autocomplete + details calls)
	const sessionTokenRef = useRef<string>(generateSessionToken());

	// Debounce timer ref
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Input ref for focus management
	const inputRef = useRef<HTMLInputElement>(null);

	// Fetch autocomplete suggestions with debounce
	const fetchSuggestions = useCallback(
		async (query: string) => {
			if (query.length < 3) {
				setSuggestions([]);
				return;
			}

			setIsLoadingSuggestions(true);
			setError(null);

			try {
				const predictions = await fetchAutocompleteSuggestions(
					query,
					googleMapsApiKey,
					sessionTokenRef.current,
					currentLocation ?? undefined,
				);
				setSuggestions(predictions);
				setShowSuggestions(true);
			} catch (err) {
				console.error("Autocomplete error:", err);
				setError("Failed to fetch suggestions");
				setSuggestions([]);
			} finally {
				setIsLoadingSuggestions(false);
			}
		},
		[currentLocation],
	);

	// Handle input change with debounce
	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setInputValue(value);
			setError(null);

			// Clear existing timeout
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}

			// Set new debounced fetch
			debounceRef.current = setTimeout(() => {
				fetchSuggestions(value);
			}, 300);
		},
		[fetchSuggestions],
	);

	// Handle place selection
	const handlePlaceSelect = useCallback(
		async (prediction: PlacePrediction) => {
			setIsSaving(true);
			setError(null);
			setShowSuggestions(false);

			try {
				// Fetch coordinates using Geocoding API (supports CORS from browser)
				const location = await fetchPlaceCoordinates(
					prediction.placeId,
					googleMapsApiKey,
				);

				// Convert to Convex format
				const convexLocation = toConvexLocation(location);

				// Validate before saving
				if (
					typeof convexLocation.lat !== "number" ||
					typeof convexLocation.lng !== "number" ||
					Number.isNaN(convexLocation.lat) ||
					Number.isNaN(convexLocation.lng)
				) {
					throw new Error("Invalid location coordinates");
				}

				// Update only the location (not weather unit)
				await setCurrentLocation({
					userId,
					defaultLocation: JSON.stringify(convexLocation),
				});

				// Update map viewport
				setViewState({
					longitude: convexLocation.lng,
					latitude: convexLocation.lat,
					zoom: 14,
				});

				// Clear input and generate new session token
				setInputValue("");
				setSuggestions([]);
				sessionTokenRef.current = generateSessionToken();
			} catch (err) {
				console.error("Error selecting place:", err);
				setError("Failed to update location");
			} finally {
				setIsSaving(false);
			}
		},
		[userId, setCurrentLocation],
	);

	// Close suggestions when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
				setShowSuggestions(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Cleanup debounce on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	const hasLocation = currentLocation !== null;

	return (
		<div className="flex flex-col gap-4">
			{/* Search Input */}
			<div className="relative" ref={inputRef}>
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/60" />
					<input
						type="text"
						value={inputValue}
						onChange={handleInputChange}
						onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
						placeholder="Search for a location..."
						className="w-full pl-10 pr-4 py-2.5 rounded-base border-2 border-border bg-background text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-main focus:border-main transition-colors"
						disabled={isSaving}
					/>
					{isLoadingSuggestions && (
						<div className="absolute right-3 top-1/2 -translate-y-1/2">
							<div className="h-4 w-4 border-2 border-main border-t-transparent rounded-full animate-spin" />
						</div>
					)}
				</div>

				{/* Suggestions Dropdown */}
				{showSuggestions && suggestions.length > 0 && (
					<ul className="absolute z-50 w-full mt-1 bg-background border-2 border-border rounded-base shadow-shadow max-h-60 overflow-auto">
						{suggestions.map((prediction) => (
							<li key={prediction.placeId}>
								<button
									type="button"
									onClick={() => handlePlaceSelect(prediction)}
									className="w-full px-4 py-3 text-left hover:bg-main/10 focus:bg-main/10 focus:outline-none transition-colors border-b border-border/30 last:border-b-0"
									disabled={isSaving}
								>
									<div className="flex items-start gap-2">
										<MapPin className="h-4 w-4 mt-0.5 text-main shrink-0" />
										<div className="min-w-0">
											<p className="text-sm font-semibold truncate">
												{prediction.structuredFormat?.mainText?.text ||
													prediction.text.text}
											</p>
											{prediction.structuredFormat?.secondaryText?.text && (
												<p className="text-xs text-foreground/60 truncate">
													{prediction.structuredFormat.secondaryText.text}
												</p>
											)}
										</div>
									</div>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>

			{/* Error Message */}
			{error && (
				<p className="text-sm text-red-400 flex items-center gap-1">
					<X className="h-4 w-4" />
					{error}
				</p>
			)}

			{/* Map Container */}
			<div className="relative rounded-base overflow-hidden border-2 border-border">
				{hasLocation ? (
					<MapboxMap
						{...viewState}
						onMove={(evt) => setViewState(evt.viewState)}
						mapboxAccessToken={mapboxAccessToken}
						style={{ width: "100%", height: 300 }}
						mapStyle="mapbox://styles/mapbox/dark-v11"
						attributionControl={false}
					>
						<Marker
							longitude={currentLocation.lng}
							latitude={currentLocation.lat}
							anchor="bottom"
						>
							<MapPin className="h-8 w-8 text-main drop-shadow-lg" />
						</Marker>
					</MapboxMap>
				) : (
					<div className="w-full h-[300px] bg-secondary-background flex flex-col items-center justify-center gap-3 text-foreground/60">
						<MapPin className="h-12 w-12 text-foreground/30" />
						<p className="text-sm text-center px-4">
							Set your default location to improve
							<br />
							location-based features
						</p>
					</div>
				)}

				{/* Saving Overlay */}
				{isSaving && (
					<div className="absolute inset-0 bg-background/80 flex items-center justify-center">
						<div className="flex items-center gap-2 text-main">
							<div className="h-5 w-5 border-2 border-main border-t-transparent rounded-full animate-spin" />
							<span className="text-sm font-semibold">Saving...</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
