import { describe, it } from "node:test";
import { futureDate } from "./util";
import assert from "node:assert";

describe('futureDate', () => {
  it('happy path', () => {
    const now = new Date()
    testPass([1, 'ms', now], new Date(now.getTime() + 1))
    testPass([1, undefined, now], new Date(now.getTime() + 1))
    testPass([1, 'm', now], new Date(now.getTime() + 1000 * 60))
    testPass([10, 'm', now], new Date(now.getTime() + 10 * 1000 * 60))
    testPass([10, 's', now], new Date(now.getTime() + 10 * 1000))
    testPass([15, 'h', now], new Date(now.getTime() + 15 * 1000 * 60 * 60))
    testPass([10, 'd', now], new Date(now.getTime() + 10 * 1000 * 60 * 60 * 24))
    testPass([0.4, 'ms', now], new Date(now.getTime()))
    testPass([0.5, 'ms', now], new Date(now.getTime()))
  })

   it('unhappy path', () => {
    const now = new Date()
    testFail([], 'Invalid amount.')
    testFail([-1], 'Invalid amount.')
    testFail([NaN], 'Invalid amount.')
    testFail([1, null], `increment must be one of: 'ms' | 's' | 'm' | 'h' | 'd'`)
    testFail([1, 'YEAR'], `increment must be one of: 'ms' | 's' | 'm' | 'h' | 'd'`)
    testFail([1, undefined, new Date(NaN)], `now must be a valid date.`)
  })

  const testPass = (args: Parameters<typeof futureDate>, expected: Date) => {
    const actual = futureDate(...args)
    assert.deepStrictEqual(actual, expected)
    return
  }

  const testFail = (args: any, expectedError: string) => {
    try {
      futureDate(...(args as unknown as Parameters<typeof futureDate>))
      throw new Error(`Expected test fail for futureDate(${args}).`)
    } catch (err: any) {
      assert.deepStrictEqual(err.message, expectedError)
    }
  }
})