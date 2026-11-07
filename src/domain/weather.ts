/** Current conditions at a Home city, in metric units (SAD §8 Units). */
export interface CurrentWeather {
  readonly readingTime: Date;
  /** WMO weather interpretation code. */
  readonly weatherCode: number;
  readonly temperatureC: number;
  readonly feelsLikeC: number;
  readonly windKmh: number;
  readonly humidityPct: number;
}

const WMO_CONDITIONS: ReadonlyMap<number, string> = new Map([
  [0, "clear sky"],
  [1, "mainly clear"],
  [2, "partly cloudy"],
  [3, "overcast"],
  [45, "fog"],
  [48, "depositing rime fog"],
  [51, "light drizzle"],
  [53, "moderate drizzle"],
  [55, "dense drizzle"],
  [56, "light freezing drizzle"],
  [57, "dense freezing drizzle"],
  [61, "slight rain"],
  [63, "moderate rain"],
  [65, "heavy rain"],
  [66, "light freezing rain"],
  [67, "heavy freezing rain"],
  [71, "slight snowfall"],
  [73, "moderate snow"],
  [75, "heavy snow"],
  [77, "snow grains"],
  [80, "slight rain showers"],
  [81, "moderate rain showers"],
  [82, "violent rain showers"],
  [85, "slight snow showers"],
  [86, "heavy snow showers"],
  [95, "thunderstorm"],
  [96, "thunderstorm with slight hail"],
  [99, "thunderstorm with heavy hail"],
]);

/** The conditions in words, or "unknown conditions" for a code the bot does not recognise (AC-08). */
export function describeConditions(code: number): string {
  return WMO_CONDITIONS.get(code) ?? "unknown conditions";
}

/** Rounds to the nearest whole number; a value that rounds to zero is 0, never -0. */
function wholeNumber(value: number): number {
  return Math.round(value) || 0;
}

/** All four numbers rounded to whole numbers (AC-08). */
export function roundReading(weather: CurrentWeather): CurrentWeather {
  return {
    ...weather,
    temperatureC: wholeNumber(weather.temperatureC),
    feelsLikeC: wholeNumber(weather.feelsLikeC),
    windKmh: wholeNumber(weather.windKmh),
    humidityPct: wholeNumber(weather.humidityPct),
  };
}

/** "00:30": the reading time as a 24-hour clock in the Home city's IANA timezone. */
export function formatLocalTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(date);
}
