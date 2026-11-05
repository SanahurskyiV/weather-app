// Port interfaces the use cases depend on. Adapters in src/adapters implement them.
// Feature work adds WeatherProvider, SubscriptionRepo, AlertLog and Notifier here.

/** Read time only through this port so tests can control it. */
export interface Clock {
  now(): Date;
}
