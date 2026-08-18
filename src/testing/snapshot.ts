import assert from "node:assert"
import fs from "node:fs"

const BG_YELLOW = '\x1b[43m'
const BLACK = '\x1b[30m'
const RESET = '\x1b[0m'
const BG_RED = '\x1b[41m'

export enum SnapshotResultType {
  MATCH = 'MATCH',
  MISMATCH = 'MISMATCH',
}

export interface SnapshotMatch<T> {
  type: SnapshotResultType.MATCH
  actual: T
  snapshot: T
}

export interface SnapshotMismatch<T> {
  type: SnapshotResultType.MISMATCH
  actual: T
  snapshot: T
  diff: string
  /**
   * The updated string to use for updating the inline snapshots.
   */
  update: string
}

export interface SnapshotRange {
  start: number, 
  end: number, 
  indent: number
}

export type SnapshotResult<T> = SnapshotMatch<T> | SnapshotMismatch<T>

/**
 * @class Snapshot
 * @description A simple inline snapshot testing library, inspired by
 * https://tigerbeetle.com/blog/2024-05-14-snapshot-testing-for-the-masses/
 * 
 * Motivation:
 * 1. The built in nodejs snapshot features store the files separately, which makes tests harder to
 *    read and the snapshots more brittle. It also doesn't support features such as ":ignore", which
 *    we have implemented here.
 * 
 * 2. Jest-based property matchers are very tricky to write, and are _almost_ snapshots but harder
 *    to update and reason about. Sometimes we just want to _see_ exactly what the response from 
 *    some API was.
 * 
 * @example
 * 
 * import { describe, it } from "node:test";
 * import { getCallerLocation, Snapshot } from "./snapshot";
 * 
 * describe('snapshot smoke test', () => {
 *   it('updates the snapshot', () => {
 *     const result = {
 *       a: true,
 *       b: {
 *         icecream: 'chocolate'
 *       },
 *       c: new Date()
 *     }
 * 
 *     Snapshot.from(getCallerLocation(), `{
 *       "a": true,
 *       "b": {
 *         "icecream": "vanilla"
 *       },
 *       "c": ":ignore"
 *     }`).checkStringUnwrap(JSON.stringify(result, null, 2))
 *   })
 * })
 * 
 * This test ^^ will fail, as the line with "icecream" doesn't match.
 * You can rerun the tests with `SNAP_UPDATE=1` and this library will try and auto-update the
 * snapshot.
 */
export class Snapshot {
  sourceLocation: CallerLocation
  text: any
  updateable: boolean

  private constructor(sourceLocation: CallerLocation, text: string, updateable: boolean) {
    this.sourceLocation = sourceLocation
    this.text = text
    this.updateable = updateable
  }

  public static from(
    text: string, 
    options: {
      stripWhitespace: boolean, // Whether or not we should display the update hint. Default: true.
      updateable: boolean       // Whether or not we should display the update hint. Default: true.
    } = {
      stripWhitespace: true,
      updateable: true,
    }) {
    const sourceLocation = getCallerLocation(2)
    if (options.stripWhitespace) {
      text = this.stripLeadingWhitespace(text)
    }
    return new Snapshot(sourceLocation, text, options.updateable)
  }

  /**
   * @description Format the text to remove indents, so we can write prettier inline snapshots:
   * 
   * E.g. if we are indented 2 layers deep, this:
   *    const snap = Snapshot.from(getCallerLocation(), `{
   *      "a": true,
   *    }
   *    `)
   * 
   * is much nicer to write than this:
   *     const snap = Snapshot.from(getCallerLocation(), `{
   * "a": true,
   * }
   * `)
   * 
   * @param text 
   */
  private static stripLeadingWhitespace(text: string): string {
    const lines = text.split('\n')
    // Check the last line for indented whitespace, otherwise the penultimate line.
    let lastLine = lines.pop()
    assert(lastLine !== undefined, 'stripLeadingWhitespace(), text was empty.')
    if (lastLine.length === 0) {
      lastLine = lines.pop()
    }
    assert(lastLine)

    const indent = lastLine.match(/^\s+/)
    if (!indent) {
      return text
    }
    assert(indent[0].length % 2 === 0, 'Malformatted string. Expected indent to be a multiple of 2.')
    const leadingSpaceRe = new RegExp(String.raw`^\s{${indent[0].length}}`, "gm");
    return text.replaceAll(leadingSpaceRe, '')
  }

  public checkString(have: string): SnapshotResult<string> {
    return checkSnapshotString(have, this.text)
  }

  /**
   * Check a `have` of any against the snapshot string.
   */
  public checkUnwrap(have: any): void {
    const haveString = JSON.stringify(have, null, 2);
    return this.checkStringUnwrap(haveString)
  }

  public checkStringUnwrap(have: string): void {
    const result = checkSnapshotString(have, this.text)

    if (result.type === SnapshotResultType.MATCH) {
      return
    }

    console.log(`Snapshot mismatch:\n${result.diff}`)

    if (!this.updateable) {
      throw new Error(`Snapshot mismatch.`)
    }
    
    if (process.env.SNAP_UPDATE === undefined) {
      throw new Error(`Snapshot mismatch. Rerun with SNAP_UPDATE=1 to update the snapshot.`)
    }
    const updated = this._replaceSnapshot('`' + result.update + '`')
    fs.writeFileSync(this.sourceLocation.file, updated)
    throw new Error(`Snapshot updated.`)
  }

  /**
   * Read the current file, replace the old snapshot with the new snapshot.
   */
  public _replaceSnapshot(update: string): string {
    assert(update[0] === '`', 'Replacement should start with a tick.')
    assert(update.endsWith('`'), 'Replacement should end with a tick.')
    const contents = fs.readFileSync(this.sourceLocation.file).toString('utf-8')
    const range = Snapshot._snapshotRange(contents, this.sourceLocation.line)
    return Snapshot._replaceSnapshot(contents, range, update)
  }

  /**
   * Replace the old snapshot in the file with a new snapshot.
   */
  public static _replaceSnapshot(contents: string, range: SnapshotRange, update: string): string {
    let newFile = contents.slice(0, range.start - 1)
    const updateLines = update.split('\n')
    updateLines.forEach((line, idx) => {
      // Don't indent the first line
      if (idx === 0) {
        newFile += line + '\n'
        return
      }
      // Skip newline on last line.
      if (idx === updateLines.length - 1) {
        newFile += ' '.repeat(range.indent) + line
        return
      }
      newFile += ' '.repeat(range.indent) + line + '\n'
    })
    newFile += contents.slice(range.end)

    return newFile;
  }

  /**
   * Find the snapshot string from ``, inclusive of start and end ticks to be updated.
   */
  public static _snapshotRange(contents: string, lineNum: number, ): SnapshotRange {
    assert(lineNum > 0)

    const lines = contents.split('\n')
    const lineIdx = lineNum - 1
    let start = 0
    let range = 0
    let indent = 0
    lines.forEach((line, idx) => {
      if (idx < lineIdx) {
        // Don't forget newlines!
        start += line.length + 1
      }
      if (idx === lineIdx) {
        const openingTickIdx = line.indexOf('`')
        if (openingTickIdx === -1) {
          throw new Error(`Couldn't find opening '\`' in snapshot string.`)
        }
        start += openingTickIdx + 1
      }
    })

    const tail = contents.slice(start)
    const tailLines = tail.split('\n')
    let foundEnd: boolean = false
    let lastLine = ''
    tailLines.forEach((line, idx) => {
      if (foundEnd) {
        return
      }

      const closingTickIdx = line.indexOf('\`')
      if (closingTickIdx === -1) {
        range += line.length + 1
        return 
      }
      range += closingTickIdx + 1
      lastLine = line
      foundEnd = true
    })
    if (!foundEnd) {
      throw new Error(`Snapshot end not found. Searched string:\n${tail}`)
    }

    // We can find the indent based on the last line before the `.
    // If there are spaces before `
    const indentMatch = lastLine.match(/^\s*/)
    if (indentMatch) {
      indent = indentMatch[0].length
    }

    return {
      start,
      end: start + range,
      indent
    }
  }
}

export function unwrapSnapshot<T>(result: SnapshotResult<T>): void {
  if (result.type === SnapshotResultType.MATCH) {
    return
  }

  console.log(`snapshot mismatch:\n${result.diff}`)

  if (process.env.SNAP_UPDATE === undefined) {
    throw new Error(`Snapshot mismatch. Rerun with SNAP_UPDATE=1 to update the snapshot.`)
  }

  throw new Error(`Snapshot updated.`)
}

enum SpecialToken {
  IGNORE = 'IGNORE',
  MATCH_STRING = 'MATCH_STRING',
  MATCH_INTEGER = 'MATCH_INTEGER',
  MATCH_DATE = 'MATCH_DATE',
  MATCH_BIGINT = 'MATCH_BIGINT',
  NONE = 'NONE',
}

/**
 * Search the line for special tokens.
 */
const matchSpecialToken = (line: string): {
  token: SpecialToken,
  index: number,
  literal: string
} => {

  const matchers: Array<[string, SpecialToken]> = [
    ['\":ignore', SpecialToken.IGNORE],
    ['\':ignore', SpecialToken.IGNORE],
    [':ignore', SpecialToken.IGNORE],
    ['\":string', SpecialToken.MATCH_STRING],
    ['\':string', SpecialToken.MATCH_STRING],
    [':string', SpecialToken.MATCH_STRING],
    ['":integer', SpecialToken.MATCH_INTEGER],
    ['\':integer', SpecialToken.MATCH_INTEGER],
    [':integer', SpecialToken.MATCH_INTEGER],
    ['":int', SpecialToken.MATCH_INTEGER],
    ['\':int', SpecialToken.MATCH_INTEGER],
    [':int', SpecialToken.MATCH_INTEGER],
    ['":date', SpecialToken.MATCH_DATE],
    ['\':date', SpecialToken.MATCH_DATE],
    [':date', SpecialToken.MATCH_DATE],
    [':bigint', SpecialToken.MATCH_BIGINT],
  ]

  for (const matcher of matchers) {
    let index = line.indexOf(matcher[0])
    if (index > -1) {
      return {
        token: matcher[1],
        index,
        literal: line.slice(index)
      }
    }
  }

  // No match.
  return {
    token: SpecialToken.NONE,
    index: 0,
    literal: ''
  }
}

export function checkSnapshotString(actual: string, snapshot: string): SnapshotResult<string> {
  assert(actual)
  assert(typeof actual === 'string')
  assert(snapshot)
  assert(typeof snapshot === 'string')

  const actualLines = actual.split('\n')
  const snapshotLines = snapshot.split('\n')
  const maxLines = Math.max(actualLines.length, snapshotLines.length)
  const mismatchedLines: Array<number> = []
  // Start with a reasonable number.
  let maxColumnLengthLeft = 45

  const specialTokens: Array<{ token: SpecialToken, line: number, col: number, literal: string }> = []

  for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
    const left = actualLines[lineIdx] || ''
    const right = snapshotLines[lineIdx] || ''
    if (left.length > maxColumnLengthLeft) {
      maxColumnLengthLeft = left.length
    }

    if ((!left && right) || (left && !right)) {
      mismatchedLines.push(lineIdx)
      continue
    }

    const specialToken = matchSpecialToken(right)
    specialTokens.push({ token: specialToken.token, line: lineIdx, col: specialToken.index, literal: specialToken.literal })
    switch (specialToken.token) {
      /**
       * We ignore the rest of the line after the index of the `:ignore`
       */
      case SpecialToken.IGNORE: {
        // if we found a skip token, then only match the line up to the token
        if (left.length < specialToken.index) {
          mismatchedLines.push(lineIdx)
          continue;
        }

        const leftTruncated = left.substring(0, specialToken.index)
        const rightTruncated = right.substring(0, specialToken.index)
        assert(leftTruncated.length === rightTruncated.length)
        if (leftTruncated !== rightTruncated) {
          mismatchedLines.push(lineIdx)
          continue;
        }
        break;
      }
      // We expect the left side to be a string
      case SpecialToken.MATCH_STRING: {
        if (left.length < specialToken.index) {
          mismatchedLines.push(lineIdx)
          continue;
        }

        // Ensure the left side is a string.
        const leftCandidate = left.substring(specialToken.index)
          .replace(',', '') // Workaround for trailing commas
        if (!leftCandidate || leftCandidate.length === 0) {
          mismatchedLines.push(lineIdx)
          continue
        }

        // Parse and see what it might be.
        try {
          const leftParsed = JSON.parse(leftCandidate)
          if (typeof leftParsed !== 'string') {
            mismatchedLines.push(lineIdx)
          }

        } catch (err) {
          mismatchedLines.push(lineIdx)
        }

        break;
      }

      // We expect the left side to be an integer.
      case SpecialToken.MATCH_INTEGER: {
        if (left.length < specialToken.index) {
          mismatchedLines.push(lineIdx)
          continue;
        }

        const leftCandidate = left.substring(specialToken.index)
          .replace(',', '') // Strip off trailing commas, a little hacky but it works!
        if (!leftCandidate || leftCandidate.length === 0) {
          mismatchedLines.push(lineIdx)
          continue
        }

        // Parse and see what it might be.
        try {
          const leftParsed = JSON.parse(leftCandidate)
          if (typeof leftParsed !== 'number') {
            mismatchedLines.push(lineIdx)
          }
        } catch (err) {
          mismatchedLines.push(lineIdx)
        }
        break;
      }
      case SpecialToken.NONE: {
        if (left !== right) {
          mismatchedLines.push(lineIdx)
          continue;
        }
        break;
      }
      default: {
        throw new Error(`${specialToken.token} not yet implemented!`)
      }
    }
  }

  if (mismatchedLines.length === 0) {
    return {
      type: SnapshotResultType.MATCH,
      actual: actual,
      snapshot: snapshot
    }
  }

  let diff = `${RESET}\n`
  maxColumnLengthLeft = Math.min(85, maxColumnLengthLeft)
  diff += `${'Actual:'.padEnd(maxColumnLengthLeft)} | Snapshot:\n`
  for (let index = 0; index < maxLines; index++) {
    let left = actualLines[index] || ''
    let right = snapshotLines[index] || ''
    // Truncate very long strings. Doesn't affect the matching.
    if (left.length > maxColumnLengthLeft) {
      left = left.slice(0, maxColumnLengthLeft - 20) + '...(truncated)'
    }
    if (right.length > maxColumnLengthLeft) {
      right = right.slice(0, maxColumnLengthLeft - 20) + '...(truncated)'
    }
    if (mismatchedLines.indexOf(index) < 0) {
      diff += `${left.padEnd(maxColumnLengthLeft)} | ${right}\n`
      continue
    }
    diff += `${BG_YELLOW}${left.padEnd(maxColumnLengthLeft)} | ${right}${RESET}\n`
  }

  return {
    type: SnapshotResultType.MISMATCH,
    actual: actual,
    snapshot: snapshot,
    diff,
    update: updateStringForActualAndTokens(actual, specialTokens)
  }
}

/**
 * @description Take the actual string, and interpolate the special tokens.
 */
function updateStringForActualAndTokens(
  input: string,
  tokens: Array<{ token: SpecialToken, line: number, col: number, literal: string }>
): string {
  let out = ""
  const lines = input.split('\n')
  if (lines.length !== tokens.length) {
    console.warn(`Couldn't update snapshot, as the number of lines don't match.`)
    return input
  }
  lines.forEach((line, idx) => {
    const token = tokens[idx]
    if (token.token === SpecialToken.NONE) {
      out += line + (idx !== lines.length -1 ? '\n' : '')
      return
    }

    const mergedLine = line.slice(0, token.col) + token.literal
    out += mergedLine + (idx !== lines.length -1 ? '\n' : '')
  })

  return out
}

type CallerLocation = {
  file: string,
  line: number,
  col: number,
}

/**
 * @description Gets the source file location of the caller.
 */
export function getCallerLocation(depth: number = 1): CallerLocation {
  const error = new Error()
  assert(error.stack)
  const line = error.stack?.split('\n')[1 + depth]
  if (!line) {
    throw new Error(`getCallerLocation() - line was undefined`);
  }
  const match = line.match(/\((.+):(\d+):(\d+)\)/) || line.match(/at (.+):(\d+):(\d+)/)
  assert(match !== null)
  assert(match!.length === 4)
  return { 
    file: match![1], 
    line: Number.parseInt(match![2]), 
    col: Number.parseInt(match![3]) 
  }
}
