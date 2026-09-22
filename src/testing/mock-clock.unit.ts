import { describe, it } from "node:test";
import Clock from "./mock-clock";
import PRNG from "./prng";
import assert from "node:assert";

describe('mock-clock', () => {
  it('ticks and ticks and ticks', () => {
    const prng = new PRNG(2141)
    const clock = new Clock(prng, new Date('2026-01-01'))
    const ticks = 100

    for (let idx = 0; idx <= ticks; idx++) {
      clock.tick()
    }
    console.log(clock.now)
    assert.deepEqual(clock.now, new Date('2026-01-01T04:11:03.132Z'))
  })
})