import assert from "node:assert";
import PRNG from "./prng";
import { futureDate, TimeUnit } from "./util";

export class Clock {
  get now(): Date {
    return new Date()
  }

  public tick(_amount?: number, _unit?: TimeUnit) {
    // Noop.
  }

  public reset() {
    // Noop.
  }
}

/**
 * @description A mock clock for injecting into the application.
 *   For now, this clock only ticks forwards, but who knows, maybe it will be
 *   able to tick backwas
 */
export default class MockClock extends Clock {
  private dateStart: Date
  private _now: Date

  constructor (private prng: PRNG, start: Date) {
    super()
    assert(prng instanceof PRNG)
    assert.ok(start instanceof Date)
    this.dateStart = start

    this._now = start
  }

  /**
   * Ticks the clock forwards by the given amount of time, or by a random one (from a few
   * milliseconds to a few days) when none is given.
   */
  public tick(amount?: number, unit: TimeUnit = 'ms') {
    if (amount === undefined) {
      unit = this.prng.randomElementWeighted<TimeUnit>(
        ['ms', 's', 'm', 'h', 'd'],
        [100, 60, 12, 5, 1],
      )
      amount = this.prng.intExclusive(3) + 1
    }

    this._now = futureDate(amount, unit, this._now)
  }

  public reset() {
    this._now = this.dateStart
  }

  get now(): Date {
    return this._now
  }
}
