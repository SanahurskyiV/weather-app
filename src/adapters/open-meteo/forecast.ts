import type { WeatherProvider } from "../../app/ports";
import { err, ok } from "../../domain/result";
import { fetchJson, isFiniteNumber, isRecord } from "./http";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const CURRENT_FIELDS = "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m";

/** WeatherProvider over Open-Meteo Forecast: current conditions, default metric units (°C, km/h). */
export function makeOpenMeteoForecast(): WeatherProvider {
  return {
    async current(latitude, longitude) {
      const url = new URL(FORECAST_URL);
      url.searchParams.set("latitude", String(latitude));
      url.searchParams.set("longitude", String(longitude));
      url.searchParams.set("current", CURRENT_FIELDS);
      url.searchParams.set("timezone", "GMT");

      const body = await fetchJson(url);
      if (!body.ok || !isRecord(body.value) || !isRecord(body.value.current)) return err("unavailable");
      const { time, temperature_2m, apparent_temperature, relative_humidity_2m, weather_code, wind_speed_10m } =
        body.value.current;
      if (
        typeof time !== "string" ||
        !isFiniteNumber(temperature_2m) ||
        !isFiniteNumber(apparent_temperature) ||
        !isFiniteNumber(relative_humidity_2m) ||
        !isFiniteNumber(weather_code) ||
        !isFiniteNumber(wind_speed_10m)
      ) {
        return err("unavailable");
      }
      // With timezone=GMT the time has no zone suffix ("2026-11-06T09:45"); it is UTC.
      const readingTime = new Date(`${time}Z`);
      if (Number.isNaN(readingTime.getTime())) return err("unavailable");

      return ok({
        readingTime,
        weatherCode: weather_code,
        temperatureC: temperature_2m,
        feelsLikeC: apparent_temperature,
        windKmh: wind_speed_10m,
        humidityPct: relative_humidity_2m,
      });
    },
  };
}
