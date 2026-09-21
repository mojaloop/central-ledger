import assert from 'node:assert'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { run } from "node:test"
import { spec } from 'node:test/reporters'
import { mergeTapStreams } from './tap-stream'
import { ResultTest, RunTask, RunTaskCoverage, RunTaskIntegration, RunTaskUnit, TagTask } from './types'
import { convertToXunit, findFiles } from './util'
import { finished } from 'node:stream/promises'

/**
 * @file run.ts
 * @description Single entrypoint for running unit tests, coverage checks, integration tests.
 */

export const PROJECT_ROOT = path.resolve(__dirname, '../..')

// Local binaries.
export const NYC_BIN = path.join(PROJECT_ROOT, 'node_modules/.bin/nyc')
export const TAPE_BIN = path.join(PROJECT_ROOT, 'node_modules/.bin/tape')
export const TAP_XUNIT_BIN = path.join(PROJECT_ROOT, 'node_modules/.bin/tap-xunit')

/**
 * @function exitWhenStdoutFlushed
 * @description Exit the process only once everything already queued on stdout has actually been
 *   written. `process.exit()` is synchronous, but writes to a non-TTY stdout (e.g. when piped into
 *   `tap-spec`) are not - calling it right after a large `console.log`/`write` can truncate that
 *   write mid-flight. Queuing an empty write and exiting in its callback guarantees everything
 *   enqueued before it has already drained, since a writable stream processes writes in order.
 */
function exitWhenStdoutFlushed(code: number | null): void {
  process.stdout.write('', () => process.exit(code))
}

async function main() {
  try {
    const task = parseOptions(process.argv.slice(2), process.env)
    switch (task.tag) {
      case 'TEST_UNIT': {
        const result = await runUnitTests(task)
        exitWhenStdoutFlushed(result.exitCode)
        break
      }
      case 'TEST_COVERAGE': {
        await runCoverage(task)
        if (task.onlyReport) {
          exitWhenStdoutFlushed(0)
        }
        return
      }
      case 'TEST_INTEGRATION': {
        const result = await runIntegrationTests(task)
        exitWhenStdoutFlushed(result.exitCode)
        break
      }
    }
  } catch (err: any) {
    console.log('Error:', err.message)
    console.log(usage)
  }
}

/**
 * @function runUnitTests
 * @description Run the unit tests based on the RunTaskUnit settings.
 */
async function runUnitTests(task: RunTaskUnit): Promise<ResultTest> {
  let results: ResultTest
  switch (task.type) {
    case 'TAPE':
      console.error('==== Running Legacy (Tape) unit tests ====')
      results = await runUnitTestsTape()
      break
    case 'NATIVE':
      console.error('==== Running New (Native) unit tests ====')
      results = await runUnitTestsNative()
      break
    case 'BOTH': {
      // Run both suites silently (only accumulating their output, not relaying it live) because
      // each one emits its own separate "TAP version 13" document. Concatenating two raw TAP
      // documents on stdout is not valid TAP, and Node's native-test TAP dialect (nested
      // subtests, large stack-trace diagnostics) crashes older TAP consumers like tap-spec
      // outright - which then throws EPIPE back into this process when it keeps writing to a
      // closed pipe. mergeTapStreams() below produces the one valid, flattened TAP document
      // that should actually reach stdout.
      console.error('==== Running Legacy (Tape) unit tests ====')
      const resultsTape = await runUnitTestsTape({ silent: true })
      assert(resultsTape.exitCode !== null, 'Encountered unknown error when runUnitTestsTape().')
      console.error('==== Running New (Native) unit tests ====')
      const resultsNative = await runUnitTestsNative({ silent: true })
      assert(resultsNative.exitCode !== null, 'Encountered unknown error when runUnitTestsNative().')

      const outputMerged = mergeTapStreams(resultsTape.output, resultsNative.output)
      const exitCodeMerged = [resultsTape, resultsNative].reduce((acc, result) => {
        assert(result.exitCode !== null)
        return acc > 0 ? acc : result.exitCode
      }, 0)

      console.log(outputMerged)

      results = {
        output: outputMerged,
        exitCode: exitCodeMerged
      }
      break
    }
  }

  if (task.output === 'XUNIT') {
    assert(task.outputPath, 'expected outputPath to be defined')

    // Export to xunit.
    await convertToXunit(results.output, task.outputPath)
  }

  return results
}

/**
 * @function runCoverage
 * @description Run the unit tests while collecting coverage, and produce the coverage report.
 * See: https://github.com/istanbuljs/nyc#combining-reports-from-multiple-runs to understand the
 * approach here.
 */
async function runCoverage(task: RunTaskCoverage): Promise<void> {
  switch (task.type) {
    case 'TAPE':
      runCoverageTape({ silent: false, clean: true })
      break
    case 'NATIVE':
      runCoverageNative({ silent: false, clean: true })
      break
    case 'INTEGRATION':
      runCoverageIntegration({ silent: true, clean: true})
      break
    case 'FUZZ':
      runCoverageIntegration({ silent: true, clean: true })
      break
    case 'ALL':
      // First run native check, but don't cleanup so we accumulate coverage between runs.
      runCoverageTape({ silent: true, clean: true })
      runCoverageNative({ silent: true, clean: false })
      runCoverageIntegration({ silent: true, clean: false })
      runCoverageFuzz({ silent: true, clean: false })
      // Generate combined report.
      spawnSync(NYC_BIN, ['report', '--reporter=lcov', '--reporter=text-summary'], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit'
      })
      break
  }

  // Check coverage thresholds unless --only-report was specified.
  if (!task.onlyReport) {
    const checkResult = spawnSync(NYC_BIN, ['check-coverage'], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    })
    if (checkResult.status !== 0) {
      process.exit(checkResult.status ?? 1)
    }
  }
}

type NycOptions = {
  silent: boolean
  clean: boolean,
}

/**
 * @function runCoverageTape
 * @description Run legacy tape tests under nyc coverage.
 */
function runCoverageTape(opts: NycOptions): void {
  const testFiles = findFiles(
    path.join(PROJECT_ROOT, 'test/unit'),
    '**/*.test.js'
  ).map(file => path.join(PROJECT_ROOT, 'test/unit', file))

  if (testFiles.length === 0) {
    console.warn(`runCoverageTape() - no test files found.`)
    return
  }

  const nycArgs: string[] = []
  if (opts.silent) nycArgs.push('--silent')
  if (!opts.clean) nycArgs.push('--no-clean')
  if (!opts.silent) nycArgs.push('--reporter=lcov', '--reporter=text-summary')

  const args = [...nycArgs, '--', TAPE_BIN, ...testFiles]
  const result = spawnSync(NYC_BIN, args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '-r ts-node/register'
    }
  })

  if (result.error) {
    console.error('Failed to run tape tests with coverage:', result.error.message)
    process.exit(1)
  }
}

/**
 * @function runCoverageNative
 * @description Run native Node.js tests under nyc coverage.
 */
function runCoverageNative(opts: NycOptions): void {
  const testFiles = findFiles(
    path.join(PROJECT_ROOT, 'src'),
    '**/*.unit.ts'
  ).map(f => path.join(PROJECT_ROOT, 'src', f))

  if (testFiles.length === 0) {
    console.warn(`runCoverageNative() - no test files found.`)
    return
  }

  const nycArgs: string[] = []
  if (opts.silent) nycArgs.push('--silent')
  if (!opts.clean) nycArgs.push('--no-clean')
  if (!opts.silent) nycArgs.push('--reporter=lcov', '--reporter=text-summary')

  const args = [
    ...nycArgs,
    '--',
    process.execPath,
    '--require', 'ts-node/register',
    '--test',
    '--test-reporter=tap',
    ...testFiles
  ]
  const result = spawnSync(NYC_BIN, args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: process.env
  })

  if (result.error) {
    console.error('Failed to run native tests with coverage:', result.error.message)
    process.exit(1)
  }
}

/**
 * @function runCoverageIntegration
 * @description Runs the integration tests with coverage.
 */
async function runCoverageIntegration(opts: NycOptions) {
  const files = findFiles(
    path.join(PROJECT_ROOT, 'src'),
    '**/*.int.ts'
  ).map(f => path.join(PROJECT_ROOT, 'src', f))

  if (files.length === 0) {
    return { output: '', exitCode: 0 }
  }

  process.once('uncaughtException', async (err) => {
    console.error(`Uncaught exception:`, err)
    process.exit(1)
  })

  process.once('unhandledRejection', async (err) => {
    console.error(`Unhandled rejection:`, err)
    process.exit(1)
  })

  const nycArgs: string[] = []
  if (opts.silent) nycArgs.push('--silent')
  if (!opts.clean) nycArgs.push('--no-clean')
  if (!opts.silent) nycArgs.push('--reporter=lcov', '--reporter=text-summary')

  const args = [
    ...nycArgs,
    '--',
    process.execPath,
    '--require', 'ts-node/register',
    '--test',
    '--test-reporter=tap',
    '--test-concurrency=2',
    ...files
  ]
  const result = spawnSync(NYC_BIN, args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: process.env
  })

  if (result.error) {
    console.error('Failed to run integration tests with coverage:', result.error.message)
    process.exit(1)
  }
}

/**
 * @function runCoverageFuzz
 * @description Runs the fuzz tests with coverage.
 */
async function runCoverageFuzz(opts: NycOptions) {
  const files = findFiles(
    path.join(PROJECT_ROOT, 'src'),
    '**/*.fuzz.ts'
  ).map(f => path.join(PROJECT_ROOT, 'src', f))

  if (files.length === 0) {
    return { output: '', exitCode: 0 }
  }

  process.once('uncaughtException', async (err) => {
    console.error(`Uncaught exception:`, err)
    process.exit(1)
  })

  process.once('unhandledRejection', async (err) => {
    console.error(`Unhandled rejection:`, err)
    process.exit(1)
  })

  const nycArgs: string[] = []
  if (opts.silent) nycArgs.push('--silent')
  if (!opts.clean) nycArgs.push('--no-clean')
  if (!opts.silent) nycArgs.push('--reporter=lcov', '--reporter=text-summary')

  const args = [
    ...nycArgs,
    '--',
    process.execPath,
    '--require', 'ts-node/register',
    '--test',
    '--test-reporter=tap',
    '--test-concurrency=2',
    ...files
  ]
  const result = spawnSync(NYC_BIN, args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: process.env
  })

  if (result.error) {
    console.error('Failed to run integration tests with coverage:', result.error.message)
    process.exit(1)
  }
}

/**
 * @function runUnitTestsTape
 * @description Run the legacy unit tests written with tape.
 */
async function runUnitTestsTape(opts: { silent?: boolean } = {}): Promise<ResultTest> {
  return new Promise((resolve) => {
    const testFiles = findFiles(
      path.join(PROJECT_ROOT, 'test/unit'),
      '**/*.test.js'
    )
      .map(file => path.join(PROJECT_ROOT, 'test/unit', file))


    if (testFiles.length === 0) {
      console.warn(`runUnitTestsTape() - no test files found.`)
      resolve({ output: '', exitCode: 0 })
      return
    }

    // Run node directly with tape module to allow debugging.
    const tapeEntry = path.join(PROJECT_ROOT, 'node_modules/tape/bin/tape')
    const proc = spawn(process.execPath, [
      '-r', 'ts-node/register',
      '--inspect',
      tapeEntry,
      ...testFiles
    ], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        NODE_OPTIONS: '-r ts-node/register'
      },
      stdio: ['inherit', 'pipe', 'pipe']
    })

    let output = ''
    proc.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString()
      output += chunk
      if (!opts.silent) process.stdout.write(chunk)
    })

    proc.stderr.on('data', (data: Buffer) => {
      process.stderr.write(data)
    })

    proc.on('close', (code) => {
      resolve({ output, exitCode: code })
    })

    proc.on('error', (err) => {
      console.error('Failed to run legacy tests:', err.message)
      resolve({ output: '', exitCode: 1 })
    })
  })
}

/**
 * @function runUnitTestsNative
 * @description Run the unit tests with the native nodejs test suite.
 */
async function runUnitTestsNative(opts: { silent?: boolean } = {}): Promise<ResultTest> {
  return new Promise((resolve) => {
    const testFiles = findFiles(
      path.join(PROJECT_ROOT, 'src'),
      '**/*.unit.ts'
    ).map(f => path.join(PROJECT_ROOT, 'src', f))

    if (testFiles.length === 0) {
      resolve({ output: '', exitCode: 0 })
      return
    }

    const proc = spawn(process.execPath, [
      '--require', 'ts-node/register',
      '--test',
      '--test-reporter=tap',
      ...testFiles
    ], {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe']
    })

    let output = ''
    proc.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString()
      output += chunk
      if (!opts.silent) process.stdout.write(chunk)
    })

    proc.stderr.on('data', (data: Buffer) => {
      process.stderr.write(data)
    })

    proc.on('close', (code) => {
      resolve({ output, exitCode: code })
    })

    proc.on('error', (err) => {
      console.error('Failed to run native tests:', err.message)
      resolve({ output: '', exitCode: 1 })
    })
  })
}

/**
 * @function runIntegrationTests
 * @description Runs the integration tests with the native nodejs test suite.
 */
async function runIntegrationTests(task: RunTaskIntegration): Promise<ResultTest> {
  const files = findFiles(
    path.join(PROJECT_ROOT, 'src'),
    '**/*.int.ts'
  ).map(f => path.join(PROJECT_ROOT, 'src', f))

  if (files.length === 0) {
    return { output: '', exitCode: 0 }
  }

  let exitCode = 0

  process.once('uncaughtException', async (err) => {
    console.error(`Uncaught exception:`, err)
    process.exit(1)
  })

  process.once('unhandledRejection', async (err) => {
    console.error(`Unhandled rejection:`, err)
    process.exit(1)
  })

  const testStream = run({
    files,
    // Run each test file in a separate process.
    isolation: 'process',
    // Tweak this depending on what resources we have.
    concurrency: 2,
  })
    .on('test:fail', () => {
      exitCode = 1
    })

  const tapStream = testStream.compose(spec)
  tapStream.pipe(process.stdout)
  await finished(testStream)

  // TODO: figure out how to export to xml to be compatible with circleci.

  return {
    output: '',
    exitCode
  }
}

const parseUnitTestOptions = (args: Array<string>): Omit<RunTaskUnit, 'tag'> => {
  let type = 'BOTH' as RunTaskUnit['type']
  let output = 'DEFAULT' as RunTaskUnit['output']
  let outputPath = undefined
  args.forEach(arg => {
    const matchType = arg.match(/--type=(.*)$/)
    if (matchType) {
      assert(matchType.length >= 2)
      switch (matchType[1]) {
        case 'tape': type = 'TAPE'; return
        case 'native': type = 'NATIVE'; return
        case 'both': type = 'BOTH'; return
        default: {
          throw new Error(`Invalid --type=${matchType[1]}, expected: tape | native | both`)
        }
      }
    }

    const matchOutput = arg.match(/^--output=(.*)$/)
    if (matchOutput) {
      assert(matchOutput.length >= 2)
      switch (matchOutput[1]) {
        case 'default': output = 'DEFAULT'; return
        case 'xunit': output = 'XUNIT'; return
        default: {
          throw new Error(`Invalid --output=${matchOutput[1]}, expected: default | xunit`)
        }
      }
    }

    const matchOutputPath = arg.match(/^--outputPath=(.*)$/)
    if (matchOutputPath) {
      assert(matchOutputPath.length >= 2)
      outputPath = matchOutputPath[1]
      assert(typeof outputPath === 'string')
      return
    }

    throw new Error(`unhandled arg: ${arg}`)
  })

  // Validate options.
  if (output === 'XUNIT' && !outputPath) {
    throw new Error('Validation error:\n    Required: `--outputPath` when `--output=xunit`.')
  }

  return { type, output, outputPath }
}

const parseCoverageOptions = (args: Array<string>): Omit<RunTaskCoverage, 'tag'> => {
  let type = 'ALL' as RunTaskCoverage['type']
  let onlyReport = false
  args.forEach(arg => {
    const matchType = arg.match(/--type=(.*)$/)
    if (matchType) {
      assert(matchType.length >= 2)
      switch (matchType[1]) {
        case 'tape': type = 'TAPE'; return
        case 'native': type = 'NATIVE'; return
        case 'fuzz': type = 'FUZZ'; return
        case 'integration': type = 'INTEGRATION'; return
        case 'all': type = 'ALL'; return
        default: {
          throw new Error(`Invalid --type=${matchType[1]}, expected: tape | native | integration | fuzz | all .`)
        }
      }
    }

    if (arg.match(/^--only-report$/)) {
      onlyReport = true
      return
    }

    throw new Error(`unhandled arg: ${arg}. Supported args for coverage are:\n  --type=[tape|native|both]\n  --only-report .`)
  })

  return {
    type,
    onlyReport
  }
}

const parseIntegrationOptions = (args: Array<string>): Omit<RunTaskIntegration, 'tag'> => {
  return {

  }
}

function parseOptions(args: Array<string>, _env: NodeJS.ProcessEnv): RunTask {
  assert(args.length > 0, 'expected at least one arg.')
  const taskCommand = args.shift()
  let tag: TagTask

  switch (taskCommand) {
    case 'unit': {
      tag = 'TEST_UNIT'
      const options = parseUnitTestOptions(args)

      return {
        tag,
        ...options,
      }
    }
    case 'coverage': {
      tag = 'TEST_COVERAGE'
      const options = parseCoverageOptions(args)

      return {
        tag,
        ...options
      }
    }
    case 'integration': {
      tag = 'TEST_INTEGRATION'
      const options = parseIntegrationOptions(args)

      return {
        tag,
        ...options
      }
    }
    case 'functional': {
      throw new Error(`'${taskCommand}' not implemented.`)
    }
    default: {
      throw new Error(`'${taskCommand}' not found.`)
    }
  }
}

const usage = `
Usage:

./testing/run.ts [unit | coverage | integration | functional]\n\n\
  'unit'          : Run the unit tests.
  'coverage'      : Run the unit tests then check coverage.
  'integration'   : Run the integration tests.
  'functional'    : *Preview - not yet implemented* Run the functional tests.


  Examples:

  # Run the unit tests.
  ./testing/run.ts unit

  # Run only the the legacy tape tests.
  ./testing/run.ts unit --type=tape

  # Run all the tests, outputting xunit
  ./testing/run.ts unit --output=xunit

  # Run the unit tests then check for coverage (will exit != 0 if it fails.)
  ./testing/run.ts coverage

  # Run coverage report only (don't check thresholds)
  ./testing/run.ts coverage --only-report

  # Run all of the integration tests.
  ./testing/run.ts integration

`

main().catch((error) => {
  console.error(error)
  process.exit(1)
})