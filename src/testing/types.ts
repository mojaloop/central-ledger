/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
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

export type TagTask = 'TEST_UNIT' | 'TEST_COVERAGE' | 'TEST_FUNCTIONAL' | 'TEST_INTEGRATION'

export type RunTask = {
  tag: 'TEST_UNIT',
  type: 'TAPE' | 'NATIVE' | 'BOTH',
  output: 'DEFAULT' | 'XUNIT',
  /* If set, will write the output to this file. */
  outputPath?: string
} | {
  tag: 'TEST_COVERAGE',
  type: 'TAPE' | 'NATIVE' | 'BOTH',
  onlyReport: boolean
}

export type RunTaskUnit = Extract<RunTask, { tag: 'TEST_UNIT' }>
export type RunTaskCoverage = Extract<RunTask, { tag: 'TEST_COVERAGE' }>

export type ResultUnitTest = {
  output: string,

  /**
   * `null` if the process exited early.
   */
  exitCode: number | null
}

/**
 * Parsed TAP test result
 */
export interface TapTest {
  /** Test number in the sequence. */
  number: number
  /** Whether the test passed. */
  ok: boolean
  /** Test description. */
  description: string
  /** Optional directive (e.g., SKIP, TODO). */
  directive?: string
}

/**
 * Parsed TAP stream
 */
export interface ParsedTap {
  /** TAP version. */
  version?: number
  /** Test plan (1..N). */
  plan: { start: number; end: number } | null
  /** Individual test results. */
  tests: TapTest[]
  /** Whether all tests passed. */
  ok: boolean
  /** Total test count. */
  total: number
  /** Number of passing tests. */
  pass: number
  /** Number of failing tests. */
  fail: number
  /** Number of skipped tests. */
  skip: number
  /** Number of todo tests. */
  todo: number
}
