import type { SetCityError } from "../../app/set-home-city";
import { formatPlaceName, type Place } from "../../domain/place";

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
  "/city Kyiv: send the set-city command followed by the city name. Add a country to pick another match, for example /city Paris, US",
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
      return notFoundReply(undefined);
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
