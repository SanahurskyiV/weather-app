import type { Clock } from "../../app/ports";

export const systemClock: Clock = {
  now: () => new Date(),
};
