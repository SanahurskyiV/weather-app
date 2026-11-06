import type { HomeCityRepo } from "../../app/ports";
import type { Place } from "../../domain/place";

interface HomeCityRow {
  name: string;
  region: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

const SELECT_BY_CHAT = "SELECT name, region, country, latitude, longitude, timezone FROM home_cities WHERE chat_id = ?";

const UPSERT = `INSERT INTO home_cities (chat_id, name, region, country, latitude, longitude, timezone, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(chat_id) DO UPDATE SET
  name = excluded.name,
  region = excluded.region,
  country = excluded.country,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  timezone = excluded.timezone,
  updated_at = excluded.updated_at`;

/** One Home city per chat, keyed by the Telegram chat id (data-model.md `home_cities`). */
export function makeD1HomeCityRepo(db: D1Database): HomeCityRepo {
  return {
    async get(chatId) {
      const row = await db.prepare(SELECT_BY_CHAT).bind(chatId).first<HomeCityRow>();
      if (!row) return undefined;
      const { region, ...rest } = row;
      return region === null ? rest : { ...rest, region };
    },

    async save(chatId, place: Place, at) {
      await db
        .prepare(UPSERT)
        .bind(
          chatId,
          place.name,
          place.region ?? null,
          place.country,
          place.latitude,
          place.longitude,
          place.timezone,
          at.toISOString(),
        )
        .run();
    },
  };
}
