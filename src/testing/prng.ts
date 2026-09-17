import assert from 'node:assert'

type Mutation =
  | 'deleteKey'
  | 'addKey'
  | 'nullifyValue'
  | 'changeType'
  | 'mutate'

/**
 * @class PRNG
 * @description A seeded Progressive Random Number Generator. Useful for setting up fuzz tests etc.
 * Ref: https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
 */
export default class PRNG {
  private a: number
  private _seed: number
  private _counterCalls: number
  prng: () => number

  constructor(seed: number) {
    this._counterCalls = 0
    this._seed = seed

    this.a = seed
    this.prng = () => {
      this._counterCalls += 1
      this.a = Math.trunc(this.a)
      this.a = Math.trunc(this.a + 0x9e3779b9)
      let t = this.a ^ this.a >>> 16
      t = Math.imul(t, 0x21f0aaad)
      t = t ^ t >>> 15
      t = Math.imul(t, 0x735a2d97)
      const num = ((t = t ^ t >>> 15) >>> 0) / 4294967296
      return num
    }
  }

  public reset() {
    this._counterCalls = 0
    this.a = this._seed
  }

  get seed() {
    return this._seed
  }

  /**
   * The number of times the PRNG has been called.
   */
  get callCount() {
    return this._counterCalls
  }

  public randomElementFrom<T>(array: Array<T>): T {
    assert(array.length > 0, 'Expected array to have at least 1 element.')
    const index = this.intExclusive(array.length)
    return array[index]
  }

  public randomElementWeighted<T>(array: Array<T>, weights: Array<number>): T {
    assert.equal(array.length, weights.length, 'Expected choices & weights to be the same length.')
    assert(array.length > 0)

    const weightsSum = weights.reduce((sum, weight) => sum + weight, 0)
    let random = this.prng() * weightsSum
    for (let idx = 0; idx < array.length; idx++) {
      random -= weights[idx]
      if (random < 0) {
        return array[idx]
      }
    }

    return array[array.length - 1]
  }

  public headsOrTails(): boolean {
    const index = this.intExclusive(2)
    if (index === 1) {
      return true
    }

    return false
  }

  public coin(): boolean {
    return this.headsOrTails()
  }

  public randomSampleFrom<T>(array: Array<T>, count: number): Array<T> {
    assert(array.length >= count)
    const shuffled = [...array].sort(() => this.prng() - 0.5)
    return shuffled.slice(0, count)
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

  public randomString(length?: number): string {
    if (!length) {
      length = this.intInRange(0, 50)
    }
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += alphabet[this.intExclusive(alphabet.length)]
    }
    return result
  }

  public randomValue(): any {
    return this.randomElementFrom([
      0,
      1,
      -1,
      Number.MAX_SAFE_INTEGER,
      NaN,
      '',
      this.randomString(10),
      null,
      undefined,
      true,
      false,
      [],
      {}
    ])
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

  public mutateObject(input: any, iterations: number = 3): any {
    if (iterations === 0 || this.headsOrTails()) {
      return input
    }

    const clone = structuredClone(input)
    const keys = Object.keys(clone)

    if (keys.length === 0) {
      clone[this.randomString(5)] = this.randomValue()
      return clone
    }

    const table = PRNG.generateWeightedChoiceTable<Mutation>({
      'deleteKey': 1,
      'addKey': 1,
      'nullifyValue': 1,
      'changeType': 2,
      'mutate': 7,
    })
    const mutation = this.randomElementFrom(table)
    const key = this.randomElementFrom(keys)
    switch (mutation) {
      case "deleteKey":
        delete clone[key]
        break
      case "addKey":
        clone[this.randomString(5)] = this.randomValue()
        break
      case "nullifyValue":
        clone[key] = this.randomElementFrom([null, undefined, ''])
        break
      case "changeType":
        clone[key] = this.randomValueDifferentType(clone[key])
        break
      case "mutate":
        if (typeof clone[key] === 'string') {
          clone[key] = this.mutateString(clone[key])
        }
        if (typeof clone[key] === 'number') {
          clone[key] = this.mutateNumber(clone[key])
        }
        if (typeof clone[key] === 'object' && clone[key] !== null) {
          clone[key] = this.mutateObject(clone[key])
        }
        break;
    }

    return this.mutateObject(clone, iterations - 1)
  }

  public mutateNumber(input: number): number {
    const mutation = this.randomElementFrom([
      'negate',
      'zero',
      'overflow',
      'fraction',
      'increment',
    ])

    switch (mutation) {
      case 'negate': return input * -1
      case 'zero': return 0
      case 'overflow': return Number.MAX_SAFE_INTEGER
      case 'fraction': return input + 0.1
      case 'increment': return input + this.intInRange(-10, 10)
      default: return input
    }
  }

  public mutateString(input: string): string {
    if (this.headsOrTails()) {
      // Safe.
      return input
    }

    if (this.headsOrTails() && input.length > 0) {
      return input.substring(0, this.intInRange(0, input.length))
    }

    return input + this.randomString(this.intInRange(1, 5))
  }

  public randomValueDifferentType(current: any): any {
    const type = typeof current
    const options = [0, '', null, true, [], {}].filter(v => typeof v !== type)
    return this.randomElementFrom(options)
  }

  public static generateWeightedChoiceTable<T extends string | number | symbol>
    (weights: any): Array<T> {
    const weightedChoiceTable: Array<T> = []
    Object.keys(weights).forEach(action => {
      const weight = weights[action]
      assert.equal(typeof weight, 'number')
      assert.ok(weight >= 0)

      for (let count = 0; count < weight; count++) {
        weightedChoiceTable.push(action as T)
      }
    })

    return weightedChoiceTable
  }
}