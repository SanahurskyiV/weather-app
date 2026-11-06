import type { WeatherError } from "../../app/get-current-weather";
import type { SetCityError } from "../../app/set-home-city";
import { formatPlaceName, type Place } from "../../domain/place";
import { type CurrentWeather, describeConditions, formatLocalTime, roundReading } from "../../domain/weather";

// Every user-facing text. Plain text only: replies never set a parse mode (spec §6.1 text safety),
// and any place name shown comes from the resolved place, never from the raw query.

const HOW_TO = ["Set your city: /city followed by its name, for example /city Kyiv", "Ask for the weather: /weather"];

export function greetingReply(homeCity: Place | undefined): string {
  const lines = ["Hi! I tell you the current weather in your city.", ...HOW_TO];
  if (homeCity) lines.push(`Your city: ${formatPlaceName(homeCity)}`);
  return lines.join("\n");
}

export const HELP_REPLY = [
  "Here is what I understand:",
  "/city Kyiv: send /city followed by the city name. Add a country to pick another match, for example /city Paris, US",
  "/weather: the current weather in your city",
  "/start: how to get started",
].join("\n");

export function groupPointerReply(botUsername: string): string {
  return `I only work in a private chat. Message me directly: @${botUsername}`;
}

export const FAULT_REPLY = "Something went wrong, please try again.";

// /city (AC-01 to AC-07, AC-16, AC-17)

const COUNTRY_EXAMPLE = "/city Paris, US";

function stillLine(current: Place | undefined): string {
  return current ? `\nYour city is still ${formatPlaceName(current)}.` : "";
}

export function cityOkReply(place: Place, ambiguous: boolean): string {
  const lines = [
    `Your city is now ${formatPlaceName(place)} (timezone ${place.timezone}).`,
    "Ask for the weather: /weather",
  ];
  if (ambiguous) lines.push(`Not the one you meant? Add a country, for example ${COUNTRY_EXAMPLE}`);
  return lines.join("\n");
}

export const CITY_USAGE_REPLY = "Send /city followed by the city name, for example /city Kyiv";

export function notFoundReply(current: Place | undefined): string {
  return (
    `I couldn't find that place. Check the spelling or add a country, for example ${COUNTRY_EXAMPLE}` +
    stillLine(current)
  );
}

export const UNAVAILABLE_REPLY = "This is temporarily unavailable. Please try again in a few minutes.";

export function unavailableReply(current: Place | undefined): string {
  return UNAVAILABLE_REPLY + stillLine(current);
}

export const USER_LIMIT_REPLY = "You're sending too many requests. Please try again later.";

export const DAILY_LIMIT_REPLY = "I've reached my daily limit. Please try again tomorrow.";

export function setCityErrorReply(error: SetCityError): string {
  switch (error.kind) {
    case "blank":
      return CITY_USAGE_REPLY;
    case "too_long":
    case "unknown_country":
    case "not_found":
      return notFoundReply(error.current);
    case "unavailable":
      return unavailableReply(error.current);
    case "user_limit":
      return USER_LIMIT_REPLY;
    case "daily_limit":
      return DAILY_LIMIT_REPLY;
  }
}

// /weather (AC-08 to AC-10, AC-16, AC-17)

/** "Weather in Kyiv, Kyiv City, Ukraine at 11:45 local time: overcast, 3 °C, feels like -1 °C, …" (AC-08). */
export function weatherReply(place: Place, weather: CurrentWeather): string {
  const w = roundReading(weather);
  return [
    `Weather in ${formatPlaceName(place)} at ${formatLocalTime(w.readingTime, place.timezone)} local time:`,
    `${describeConditions(w.weatherCode)}, ${String(w.temperatureC)} °C, feels like ${String(w.feelsLikeC)} °C, ` +
      `wind ${String(w.windKmh)} kilometres per hour, humidity ${String(w.humidityPct)}%`,
  ].join("\n");
}

export const NO_HOME_CITY_REPLY =
  "You haven't set a city yet. Send /city followed by the city name, for example /city Kyiv";

export function weatherErrorReply(error: WeatherError): string {
  switch (error.kind) {
    case "no_home_city":
      return NO_HOME_CITY_REPLY;
    case "unavailable":
      return UNAVAILABLE_REPLY;
    case "user_limit":
      return USER_LIMIT_REPLY;
    case "daily_limit":
      return DAILY_LIMIT_REPLY;
  }
}
