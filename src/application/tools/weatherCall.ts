import type {
	FormattedWeather,
	WeatherConditionLite,
} from "../baml_client/types";
import { env } from "../core/env";

// Weather API interfaces based on OpenWeatherMap OneCall API
export interface WeatherCondition {
	id: number;
	main: string;
	description: string;
	icon: string;
}

export interface CurrentWeather {
	dt: number;
	sunrise: number;
	sunset: number;
	temp: number;
	feels_like: number;
	pressure: number;
	humidity: number;
	dew_point: number;
	uvi: number;
	clouds: number;
	visibility: number;
	wind_speed: number;
	wind_deg: number;
	weather: WeatherCondition[];
}

export interface DailyTemp {
	day: number;
	min: number;
	max: number;
	night: number;
	eve: number;
	morn: number;
}

export interface DailyFeelsLike {
	day: number;
	night: number;
	eve: number;
	morn: number;
}

export interface DailyWeather {
	dt: number;
	sunrise: number;
	sunset: number;
	moonrise: number;
	moonset: number;
	moon_phase: number;
	summary: string;
	temp: DailyTemp;
	feels_like: DailyFeelsLike;
	pressure: number;
	humidity: number;
	dew_point: number;
	wind_speed: number;
	wind_deg: number;
	wind_gust: number;
	weather: WeatherCondition[];
	clouds: number;
	pop: number;
	uvi: number;
	rain?: number;
}

export interface WeatherAlert {
	sender_name: string;
	event: string;
	start: number;
	end: number;
	description: string;
	tags: string[];
}

export interface WeatherResponse {
	lat: number;
	lon: number;
	timezone: string;
	timezone_offset: number;
	current: CurrentWeather;
	daily: DailyWeather[];
	alerts?: WeatherAlert[];
}

/**
 * Helper function to convert Kelvin to Fahrenheit
 * @param kelvin - Temperature in Kelvin
 * @returns number - Temperature in Fahrenheit
 */
function kelvinToFahrenheit(kelvin: number): number {
	return ((kelvin - 273.15) * 9) / 5 + 32;
}

/**
 * Helper function to convert Kelvin to Celsius
 * @param kelvin - Temperature in Kelvin
 * @returns number - Temperature in Celsius
 */
function kelvinToCelsius(kelvin: number): number {
	return kelvin - 273.15;
}

/**
 * Helper function to format weather data for display
 * @param weatherData - Weather response data
 * @param unit - Temperature unit to use ("C" or "F")
 * @returns FormattedWeather - Formatted weather information
 */
function formatWeatherData(
	weatherData: WeatherResponse,
	unit: "C" | "F" = "F",
): FormattedWeather {
	const current = weatherData.current;
	const convertTemp = unit === "C" ? kelvinToCelsius : kelvinToFahrenheit;

	// Helper function to ensure weather conditions are always present
	const getWeatherCondition = (
		weatherArray: WeatherCondition[],
	): WeatherConditionLite => {
		if (weatherArray && weatherArray.length > 0) {
			const condition = weatherArray[0];
			if (!condition) {
				return {
					id: 800,
					main: "Clear",
					description: "clear sky",
					icon: "01d",
				};
			}
			return {
				id: condition.id,
				main: condition.main,
				description: condition.description,
				icon: condition.icon,
			};
		}
		return {
			id: 800,
			main: "Clear",
			description: "clear sky",
			icon: "01d",
		};
	};

	return {
		location: {
			lat: weatherData.lat,
			lon: weatherData.lon,
			timezone: weatherData.timezone,
		},
		current: {
			temperature: convertTemp(current.temp),
			feels_like: convertTemp(current.feels_like),
			conditions: getWeatherCondition(current.weather),
			humidity: current.humidity,
			pressure: current.pressure,
			wind_speed: current.wind_speed,
			wind_direction: current.wind_deg,
			visibility: current.visibility,
			uv_index: current.uvi,
			clouds: current.clouds,
		},
		daily_forecast: weatherData.daily.map((day) => ({
			date: new Date(day.dt * 1000).toISOString(),
			summary: day.summary,
			temperature: {
				day: convertTemp(day.temp.day),
				min: convertTemp(day.temp.min),
				max: convertTemp(day.temp.max),
				night: convertTemp(day.temp.night),
			},
			conditions: getWeatherCondition(day.weather),
			precipitation_probability: day.pop,
			rain: day.rain || 0,
		})),
		alerts: weatherData.alerts || [],
	};
}

/**
 * Fetches and formats weather data from OpenWeatherMap OneCall API
 * @param lat - Latitude coordinate
 * @param lon - Longitude coordinate
 * @param preferredUnit - Temperature unit preference ("C" or "F", defaults to "F")
 * @returns Promise<FormattedWeather> - Formatted weather data in requested unit
 */
export async function getWeatherData(
	lat: number,
	lon: number,
	preferredUnit: "C" | "F" = "F",
): Promise<FormattedWeather> {
	const apiKey = env.OPENWEATHERMAP_API_KEY;

	if (!apiKey) {
		throw new Error("OPENWEATHERMAP_API_KEY environment variable is required");
	}

	const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly&appid=${apiKey}`;

	try {
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(
				`Weather API request failed: ${response.status} ${response.statusText}`,
			);
		}

		const data = (await response.json()) as WeatherResponse;
		return formatWeatherData(data, preferredUnit);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to fetch weather data: ${error.message}`);
		}
		throw new Error("Failed to fetch weather data: Unknown error");
	}
}
