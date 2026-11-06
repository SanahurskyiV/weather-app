# Open-Meteo adapter

Implements the `PlaceLookup` (`geocoding.ts`) and `WeatherProvider` (`forecast.ts`) ports against the
Open-Meteo geocoding and forecast APIs. Every call gives up after 1.5 s, and any failure is `unavailable`.
Free for non-commercial use, CC-BY 4.0 data: see https://open-meteo.com/en/terms.
