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
