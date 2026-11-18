import { describe, it } from "node:test";
import assert from "node:assert";
import MockClock from "./mock-clock";
import PRNG from "./prng";

describe('mock-clock', () => {
  it('ticks and ticks and ticks', () => {
    const prng = new PRNG(2141)
    const clock = new MockClock(prng, new Date('2026-01-01'))
    const ticks = 100

    for (let idx = 0; idx <= ticks; idx++) {
      clock.tick()
    }
    assert.deepEqual(clock.now, new Date('2026-01-01T04:11:03.132Z'))
  })

  it('ticks forwards by a given amount of time', () => {
    const clock = new MockClock(new PRNG(2141), new Date('2026-01-01'))

    clock.tick(6, 'd')
    clock.tick(90, 'm')
    clock.tick(500)
    assert.deepEqual(clock.now, new Date('2026-01-07T01:30:00.500Z'))
  })

  it('resets to where it started', () => {
    const clock = new MockClock(new PRNG(2141), new Date('2026-01-01'))

    clock.tick(1, 'h')
    clock.reset()
    assert.deepEqual(clock.now, new Date('2026-01-01'))
  })
})
