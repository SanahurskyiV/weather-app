import type { Place } from "../domain/place";
import type { HomeCityRepo } from "./ports";

/** The chat's Home city for the start greeting (AC-11). No lookup and no counting. */
export function makeGetHomeCity(repo: HomeCityRepo) {
  return (chatId: number): Promise<Place | undefined> => repo.get(chatId);
}

export type GetHomeCity = ReturnType<typeof makeGetHomeCity>;
