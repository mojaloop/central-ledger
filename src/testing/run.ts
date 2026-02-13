import assert from 'node:assert'
import path from 'node:path'
import { convertToXunit, findFiles } from './util'
import { spawn, spawnSync } from 'node:child_process'
import { ResultUnitTest, RunTask, RunTaskCoverage, RunTaskUnit, TagTask } from './types'
import { mergeTapStreams } from './tap-stream'

/**
 * @file run.ts
 * @description Single entrypoint for running unit tests, coverage checks, integration tests.
 */

export const PROJECT_ROOT = path.resolve(__dirname, '../..')

// Local binaries.
export const NYC_BIN = path.join(PROJECT_ROOT, 'node_modules/.bin/nyc')
export const TAPE_BIN = path.join(PROJECT_ROOT, 'node_modules/.bin/tape')
export const TAP_XUNIT_BIN = path.join(PROJECT_ROOT, 'node_modules/.bin/tap-xunit')

async function main() {
  try {
    const task = parseOptions(process.argv.slice(2), process.env)
    switch (task.tag) {
      case 'TEST_UNIT': {
        const result = await runUnitTests(task)
        process.exit(result.exitCode)
      }
      case 'TEST_COVERAGE':
        await runCoverage(task)
        if (task.onlyReport) {
          process.exit(0)
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
async function runUnitTests(task: RunTaskUnit): Promise<ResultUnitTest> {
  let results: ResultUnitTest
  switch (task.type) {
    case 'TAPE':
      console.log('==== Running Legacy (Tape) unit tests ====')
      results = await runUnitTestsTape()
      break
    case 'NATIVE':
      console.log('==== Running New (Native) unit tests ====')
      results = await runUnitTestsNative()
      break
    case 'BOTH': {
      console.log('==== Running Legacy (Tape) unit tests ====')
      const resultsTape = await runUnitTestsTape()
      assert(resultsTape.exitCode !== null, 'Encountered unknown error when runUnitTestsTape().')
      console.log('==== Running New (Native) unit tests ====')
      const resultsNative = await runUnitTestsNative()
      assert(resultsNative.exitCode !== null, 'Encountered unknown error when runUnitTestsNative().')

      const outputMerged = mergeTapStreams(resultsTape.output, resultsNative.output)
      const exitCodeMerged = [resultsTape, resultsNative].reduce((acc, result) => {
        assert(result.exitCode !== null)
        return acc > 0 ? acc : result.exitCode
      }, 0)

      console.log('==== Merged test results ====')
      const summaryText = outputMerged.split('\n')
        .filter(line => line.match(/^#/))
        .join('\n')
      console.log(summaryText)

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
 *
 * For BOTH: uses --silent and --no-clean to accumulate coverage, then nyc report.
 * See: https://github.com/istanbuljs/nyc#combining-reports-from-multiple-runs
 */
async function runCoverage(task: RunTaskCoverage): Promise<void> {
  switch (task.type) {
    case 'TAPE':
      runCoverageTape({ silent: false, noClean: false })
      break
    case 'NATIVE':
      runCoverageNative({ silent: false, noClean: false })
      break
    case 'BOTH':
      // Run both with --silent, second with --no-clean to accumulate.
      runCoverageTape({ silent: true, noClean: false })
      runCoverageNative({ silent: true, noClean: true })
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
  noClean: boolean
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
  if (opts.noClean) nycArgs.push('--no-clean')
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
  if (opts.noClean) nycArgs.push('--no-clean')
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
 * @function runUnitTestsTape
 * @description Run the legacy unit tests written with tape.
 */
async function runUnitTestsTape(): Promise<ResultUnitTest> {
  return new Promise((resolve) => {
    const testFiles = findFiles(
      path.join(PROJECT_ROOT, 'test/unit'),
      '**/*.test.js'
    ).map(file => path.join(PROJECT_ROOT, 'test/unit', file))

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
      process.stdout.write(chunk)
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
 * @description Run the unit tests written with the native nodejs test suite.
 */
async function runUnitTestsNative(): Promise<ResultUnitTest> {
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
      process.stdout.write(chunk)
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
  let type = 'BOTH' as RunTaskUnit['type']
  let onlyReport = false
  args.forEach(arg => {
    const matchType = arg.match(/--type=(.*)$/)
    if (matchType) {
      assert(matchType.length >= 2)
      switch (matchType[1]) {
        case 'tape': type = 'TAPE'; return
        case 'native': type = 'NATIVE'; return
        case 'both': type = 'BOTH'; return
        default: {
          throw new Error(`Invalid --type=${matchType[1]}, expected: tape | native | both .`)
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
      throw new Error(`'${taskCommand}' not implemented.`)
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
  'integration'   : *Preview - not yet implemented* Run the integration tests.
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

`

main().catch((error) => {
  console.error(error)
  process.exit(1)
})