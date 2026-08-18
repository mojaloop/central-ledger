import { describe, it } from "node:test";
import { Snapshot, SnapshotRange } from "./snapshot";
import assert from "node:assert";

/**
 * This is an example test for how the snapshot testing library works.
 */
describe('snapshot smoke test', () => {
  it('updates the snapshot', () => {
    const result = {
      a: true,
      b: {
        icecream: 'yummy21'
      },
      c: new Date()
    }

    Snapshot.from(`{
      "a": true,
      "b": {
        "icecream": "yummy21"
      },
      "c": ":ignore"
    }`).checkStringUnwrap(JSON.stringify(result, null, 2))
  })
})

describe('replaceSnapshot()', () => {
  it('replaces the old snapshot with the new', () => {
    const contents = '\n\nSnapshot.from(\`{\n      "a": true,\n      "c": ":ignore"\n    }\n    `).checkStringUnwrap(JSON.stringify(result, null, 2))'
    const range = Snapshot._snapshotRange(contents, 3)
    const newSnapshot = '\`{\n  "a": true,\n  "c": ":ignore"\n}\n`'
    const expected = '\n\nSnapshot.from(\`{\n      "a": true,\n      "c": ":ignore"\n    }\n    `).checkStringUnwrap(JSON.stringify(result, null, 2))'
    const actual = Snapshot._replaceSnapshot(contents, range, newSnapshot)

    assert.equal(actual, expected)
  })
})

describe('snapshotRange()', () => {
  it('snapshotRange() gets the range inbetween ``', () => {
    check('\n`thing`\n', 2, {start: 2, end: 8, indent: 0})

    check('aaa`thingbbb`ccc', 1, {start: 4, end: 13, indent: 0})
    checkSplit('aaa`thingbbb`ccc', 1, ['aaa', '`thingbbb`', 'ccc'])
    
    check('\nblabla\n      `{\n      "a": true,\n      "b": {\n        "icecream": "yummy"\n      },\n      "c": ":ignore"\n    }\n    `', 3, {start: 15, end: 116, indent: 4} )
    checkSplit(
      '\nblabla\n      `{\n      "a": true,\n      "b": {\n        "icecream": "yummy"\n      },\n      "c": ":ignore"\n    }\n    `', 
      3, 
      [
        '\nblabla\n      ', 
        '`{\n      "a": true,\n      "b": {\n        "icecream": "yummy"\n      },\n      "c": ":ignore"\n    }\n    `', 
        '', 
      ]
    )

    check(
    `Snapshot.from(\`{
      "a": true,
      "b": {
        "icecream": "yummy"
      },
      "c": ":ignore"
    }\`).checkStringUnwrap(JSON.stringify(result, null, 2))`
    , 1, {start: 15, end: 111, indent: 4})

    check(
    `Snapshot.from(\`{
      "a": true,
      "c": ":ignore"
    }
    \`).checkStringUnwrap(JSON.stringify(result, null, 2))`
    , 1, {start: 15, end: 66, indent: 4})
  })

  const check = (input: string, startLine: number, expected: SnapshotRange) => {
    const result = Snapshot._snapshotRange(input, startLine)
    assert.deepEqual(result, expected)
  }

  const checkSplit = (input: string, startLine: number, expect: [string, string, string]) => {
    const result = Snapshot._snapshotRange(input, startLine)
    const head = input.slice(0, result.start - 1)
    const body = input.slice(result.start - 1, result.end)
    const tail = input.slice(result.end)

    assert.equal(head, expect[0])
    assert.equal(body, expect[1])
    assert.equal(tail, expect[2])
  }
})
