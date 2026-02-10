import assert from 'node:assert'

/**
 * @class PRNG
 * @description A seeded Progressive Random Number Generator. Useful for setting up fuzz tests etc.
 *   Reference: https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
 */
export default class PRNG {
  prng: () => number

  constructor(seed: number) {
    this.prng = splitmix32(seed)
  }

  public randomElementFrom<T>(array: Array<T>): T {
    assert(array.length > 0, 'Expected array to have at least 1 element.')
    const index = this.intExclusive(array.length)
    return array[index]
  }

  public intExclusive(bound: number): number {
    assert(typeof bound === 'number')
    assert(bound > 0)
    
    const max = 0xFFFFFFFF
    const threshold = max - (max % bound)

    while (true) {
      const r = Math.floor(this.prng() * 0x100000000)
      if (r < threshold) {
        return r % bound
      }
    }
  }

  public intInRange(min: number, max: number): number {
    assert(max > min, 'Max must be greater than min.')
    const range = max - min
    return min + this.intExclusive(range)
  }

  public randomBytes(size: number): Buffer {
    const buffer = Buffer.alloc(size)
    for (let i = 0; i < size; i++) {
      // Convert float [0,1) to int [0,255].
      buffer[i] = Math.floor(this.prng() * 256)
    }
    return buffer
  }

  public uuidv4(): string {
    const buf = this.randomBytes(16)
    // Set version (4) bits: byte 6 (index 6), bits 4 high bits.
    buf[6] = (buf[6] & 0x0f) | 0x40

    // Set variant bits: byte 8 (index 8), high 2 bits to 10.
    buf[8] = (buf[8] & 0x3f) | 0x80

    // Convert to UUID string.
    const hex = buf.toString("hex")

    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32),
    ].join("-")
  }
}

function splitmix32(a: number) {
  return function () {
    a = Math.trunc(a)
    a = Math.trunc(a + 0x9e3779b9)
    let t = a ^ a >>> 16
    t = Math.imul(t, 0x21f0aaad)
    t = t ^ t >>> 15
    t = Math.imul(t, 0x735a2d97)
    return ((t = t ^ t >>> 15) >>> 0) / 4294967296
  }
}
