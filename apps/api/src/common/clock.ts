export interface Clock {
  now(): Date;
}

export const APP_CLOCK = Symbol('APP_CLOCK');

export const systemClock: Clock = { now: () => new Date() };
