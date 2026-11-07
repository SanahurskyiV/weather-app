import { describe, expect, it } from "vitest";
import type { Place } from "../domain/place";
import { makeGetHomeCity } from "./get-home-city";
import type { HomeCityRepo } from "./ports";

const kyiv: Place = {
  name: "Kyiv",
  region: "Kyiv City",
  country: "Ukraine",
  latitude: 50.45,
  longitude: 30.52,
  timezone: "Europe/Kyiv",
};

function fakeRepo(rows: Record<number, Place>): HomeCityRepo & { reads: number[] } {
  const reads: number[] = [];
  return {
    reads,
    get(chatId) {
      reads.push(chatId);
      return Promise.resolve(rows[chatId]);
    },
    save() {
      return Promise.reject(new Error("getHomeCity must not save"));
    },
  };
}

describe("getHomeCity", () => {
  it("returns the chat's Home city (AC-11)", async () => {
    const repo = fakeRepo({ 100001: kyiv });
    expect(await makeGetHomeCity(repo)(100001)).toEqual(kyiv);
  });

  it("returns undefined for a chat with no Home city (AC-11)", async () => {
    const repo = fakeRepo({ 100001: kyiv });
    expect(await makeGetHomeCity(repo)(100002)).toBeUndefined();
  });

  it("reads only the asking chat's row (AC-14)", async () => {
    const repo = fakeRepo({ 100001: kyiv });
    await makeGetHomeCity(repo)(100002);
    expect(repo.reads).toEqual([100002]);
  });
});
