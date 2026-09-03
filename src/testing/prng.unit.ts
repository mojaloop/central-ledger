import { describe, it } from "node:test";
import PRNG from "./prng";
import assert from "node:assert";

describe('prng', () => {
  it('increments and resets', () => {
    const seed = 823498
    const steps = 10

    const sequenceA: Array<number> = []
    const sequenceB: Array<number> = []
    const prng = new PRNG(seed)
    assert.equal(prng.callCount, 0)

    for (let idx = 0; idx < steps; idx++) {
      sequenceA.push(prng.prng())      
    }

    assert.equal(prng.callCount, steps)

    // Now reset and do it again.
    prng.reset()
    for (let idx = 0; idx < steps; idx++) {
      sequenceB.push(prng.prng())
    }
    assert.equal(prng.callCount, steps)
    assert.deepStrictEqual(sequenceA, sequenceB)
  })

  it('different sequences produce different outcomes', () => {
    const seedA = 823498
    const seedB = 823499
    const steps = 20

    const sequenceA: Array<number> = []
    const sequenceB: Array<number> = []
    const prngA = new PRNG(seedA)
    const prngB = new PRNG(seedB)

    for (let idx = 0; idx < steps; idx++) {
      sequenceA.push(prngA.prng())
      sequenceB.push(prngB.prng())
    }
    assert.notDeepStrictEqual(sequenceA, sequenceB)
  })
})