/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------

 ******/

import { ParsedTap } from './types'

/**
 * @function parseTestResult
 * @description Parse a test result line and update counters.
 */
function parseTestResult(testMatch: RegExpMatchArray, result: ParsedTap): void {
  const ok = testMatch[1] === 'ok'
  const number = Number.parseInt(testMatch[2], 10)
  let description = (testMatch[3] || '').replace(/^ - |^ /, '')
  let directive: string | undefined

  // Check for directives.
  const directiveMatch = description.match(/# ?(SKIP|TODO)\b/i)
  if (directiveMatch) {
    directive = directiveMatch[1].toUpperCase()
    description = description.replace(directiveMatch[0], '').trim()
  }

  result.tests.push({ number, ok, description, directive })
  result.total++

  if (directive === 'SKIP') {
    result.skip++
  } else if (directive === 'TODO') {
    result.todo++
  } else if (ok) {
    result.pass++
  } else {
    result.fail++
    result.ok = false
  }
}

/**
 * @function parseTap
 * @description Parse a TAP output string into a structured format.
 */
export function parseTap(tap: string): ParsedTap {
  const lines = tap.split('\n')
  const result: ParsedTap = {
    version: undefined,
    plan: null,
    tests: [],
    ok: true,
    total: 0,
    pass: 0,
    fail: 0,
    skip: 0,
    todo: 0
  }

  for (const line of lines) {
    // Parse TAP version.
    const versionMatch = line.match(/^TAP version (\d+)/)
    if (versionMatch) {
      result.version = Number.parseInt(versionMatch[1], 10)
      continue
    }

    // Parse plan (1..N).
    const planMatch = line.match(/^(\d+)\.\.(\d+)/)
    if (planMatch) {
      result.plan = {
        start: Number.parseInt(planMatch[1], 10),
        end: Number.parseInt(planMatch[2], 10)
      }
      continue
    }

    // Parse test result (ok/not ok).
    const testMatch = line.match(/^(ok|not ok) +(\d+)\b(.*)$/)
    if (testMatch) {
      parseTestResult(testMatch, result)
    }
  }

  return result
}

/**
 * @function mergeTapStreams
 * @description Merge two TAP streams into a single TAP output. Tests from the second stream are 
 *   renumbered to follow the first.
 */
export function mergeTapStreams(legacy: string, native: string): string {
  const legacyParsed = parseTap(legacy)
  const nativeParsed = parseTap(native)

  const legacyCount = legacyParsed.total
  const totalCount = legacyCount + nativeParsed.total

  const lines: string[] = []

  lines.push('TAP version 13', `1..${totalCount}`)

  // Add legacy tests (keep original numbering).
  for (const test of legacyParsed.tests) {
    const status = test.ok ? 'ok' : 'not ok'
    let line = `${status} ${test.number} - ${test.description}`
    if (test.directive) {
      line += ` # ${test.directive}`
    }
    lines.push(line)
  }

  // Add native tests (renumber starting after legacy).
  for (const test of nativeParsed.tests) {
    const newNumber = legacyCount + test.number
    const status = test.ok ? 'ok' : 'not ok'
    let line = `${status} ${newNumber} - ${test.description}`
    if (test.directive) {
      line += ` # ${test.directive}`
    }
    lines.push(line)
  }

  // Add summary comments.
  const totalPass = legacyParsed.pass + nativeParsed.pass
  const totalFail = legacyParsed.fail + nativeParsed.fail
  const totalSkip = legacyParsed.skip + nativeParsed.skip

  lines.push('', 
    `# tests ${totalCount}`,
    `# pass ${totalPass}`,
    `# fail ${totalFail}`,
  )
  if (totalSkip > 0) {
    lines.push(`# skip ${totalSkip}`)
  }

  if (totalFail === 0) {
    lines.push('', '# ok')
  }

  return lines.join('\n')
}