import { describe, it } from "node:test";
import { envOrDefaultNumber } from "../util";
import { ApplicationConfig } from "../../lib/config";
import PRNG from "../prng";
import Harness from "../harness/harness";
import * as ApiHelpers from '../../testing/api-helpers'
import { PaymentPrepareResult, PaymentPrepareResultType, PrepareHandlerInput } from "../../handlers/payment-prepare";
import assert from "node:assert";
import { optional } from "joi";

const seed = envOrDefaultNumber('SEED', Math.floor(Math.random() * 1e8))
const prng = new PRNG(seed)
Harness.injectPrngAndPatchDateGlobal(prng)
const harness = Harness.getInstance()

describe('ledger benchmark', () => {
  it('LedgerSQL vs LedgerTigerBeetle prepare()', async () => {
    const options = {
      tag: 'PREPARE' as 'PREPARE',
      payments: envOrDefaultNumber('PAYMENTS', 1000)
    }

    const resultA = await run({
      ...options,
      bucketSize: 10,
    }, { LEDGER: 'SQL' })
    const resultB = await run({
      ...options,
      bucketSize: 1250,
    }, { LEDGER: 'TIGERBEETLE' })

    const left = printResult(resultA)
    const right = printResult(resultB)
    printSideBySide(left, right, {labelLeft: 'LEDGER=SQL', labelRight: 'LEDGER=TigerBeetle'})
  })

  it.only('LedgerSQL vs LedgerTigerBeetle prepareAndFulfil()', async () => {
    const options = {
      tag: 'E2E' as 'E2E',
      payments: envOrDefaultNumber('PAYMENTS', 1000),
    }

    const resultA = await run({
      ...options,
      bucketSize: 10,
    }, { LEDGER: 'SQL' })
    const resultB = await run({
      ...options,
      bucketSize: 1250,
    }, { LEDGER: 'TIGERBEETLE' })

    const left = printResult(resultA)
    const right = printResult(resultB)
    printSideBySide(left, right, { labelLeft: 'LEDGER=SQL', labelRight: 'LEDGER=TigerBeetle' })
  })
})

type Result = {
  options: BenchmarkOptions
  durationMs: number,
  durationsPerBucket: Array<number>,
  tpsAvg: number,
  latencyP100: number
  latencyP99: number
  latencyP95: number
  latencyP50: number
  countPass: number
  countFail: number
}

type BenchmarkOptions = {
  tag: 'PREPARE'
  payments: number,
  bucketSize: number
} | {
  tag: 'E2E',
  payments: number,
  bucketSize: number
}

const printResult = (result: Result): string => {
  let bucketSummary = ``
  if (result.durationsPerBucket.length > 5) {
    // Show first 3 and last 2.
    const first = result.durationsPerBucket.slice(0, 3)
    const last = result.durationsPerBucket.slice(-2)
    bucketSummary = `[` + first.map(ms => Math.floor(ms)).join(', ')
    bucketSummary += ` ... `
    bucketSummary += last.map(ms => Math.floor(ms)).join(', ') + `]`
  } else {
    bucketSummary = `[` + result.durationsPerBucket.map(ms => Math.floor(ms)).join(', ') + `]`
  }

  let printer = ``
  switch (result.options.tag) {
    case "PREPARE":
      printer += `payments=           ${result.options.payments.toLocaleString()}\n`
      printer += `bucketSize=         ${result.options.bucketSize.toLocaleString()}\n`
    break
    case "E2E":
      printer += `payments=           ${result.options.payments.toLocaleString()}\n`
      printer += `bucketSize=         ${result.options.bucketSize.toLocaleString()}\n`
    break
    default:
      // @ts-ignore
      throw new Error(`unknown options.tag: ${result.options.tag}`)
  }

  printer += `durationMs=         ${Math.floor(result.durationMs).toLocaleString()}\n`
  printer += `paymentsPerSecond=  ${Math.floor(result.tpsAvg).toLocaleString()}\n`
  printer += `durationMsBuckets= ${bucketSummary}\n`
  printer += `latencies:\n`
  printer += `  p100           =  ${Math.floor(result.latencyP100)}\n`
  printer += `  p99            =  ${Math.floor(result.latencyP99)}\n`
  printer += `  p95            =  ${Math.floor(result.latencyP95)}\n`
  printer += `  p50            =  ${Math.floor(result.latencyP50)}\n`
  printer += `[${result.countPass.toLocaleString()}/${(result.countFail + result.countPass).toLocaleString()} Passed]`

  return printer
}

const printSideBySide = (
  left: string,
  right: string,
  options: {
    labelLeft: string,
    labelRight: string
  }
): void => {
  assert(left)
  assert(right)
  assert(options)
  assert(options.labelLeft)
  assert(options.labelRight)

  const paddingLeft = left.split('\n').reduce((acc, curr) => {
    if (curr.length > acc) return curr.length
    return acc
  }, 0)
  let printer = ``
  printer += ``.padEnd(paddingLeft - 2, '=') + `Results` + ``.padEnd(paddingLeft, '=') + `\n`
  printer += options.labelLeft.padEnd(paddingLeft) + ` | ` + options.labelRight
  console.log(printer)
  const linesLeft = left.split('\n')
  const linesRight = right.split('\n')
  assert.equal(linesLeft.length, linesRight.length)
  linesLeft.forEach((left, idx) => {
    const right = linesRight[idx]

    console.log(left.padEnd(paddingLeft) + ` | ` + right)
  })
}


const run = async (
  options: BenchmarkOptions,
  config: Partial<ApplicationConfig>
): Promise<Result> => {
  try {
    await harness.up()
    harness.configOverride(config)
    await harness.setupGlobals()

    const benchmark = new LedgerBenchmark(options, harness)
    await benchmark.run()

    return benchmark.getResults()
  } catch (err: any) {
    console.error(err.message)
    console.error(err.stack)
    throw err
  } finally {
    await harness.teardownGlobals()
    await harness.down()
  }
}


class LedgerBenchmark {
  private result: Result | null = null

  constructor(private options: BenchmarkOptions, private harness: Harness) { }

  public async run(): Promise<void> {
    await ApiHelpers.buildHub().deps(harness).currency('USD').build().create()
    const dfsps: Array<string> = ['dfsp_a', 'dfsp_b', 'dfsp_c', 'dfsp_d']
    for (const dfsp of dfsps) {
      await ApiHelpers
        .buildDfsp()
        .deps(harness)
        .name(dfsp)
        .currency('USD', 1_0000_000)
        .build()
        .create()
    }

    // Create a bunch of prepares.
    const payments: Array<ApiHelpers.Payment> = Array.from(
      { length: this.options.payments },
      () => LedgerBenchmark.makeRandomPayment(this.harness, dfsps, 'USD')
    )
    const prepares: Array<PrepareHandlerInput> = payments.map(payment => payment.toPrepare())

    // Batch into maximum batch sizes.
    const prepareBuckets: Array<Array<PrepareHandlerInput>> = prepares.reduce((acc, item, idx) => {
      const idxBucket = Math.floor(idx / this.options.bucketSize)
      acc[idxBucket] = acc[idxBucket] || []
      acc[idxBucket].push(item)
      return acc
    }, [] as Array<Array<PrepareHandlerInput>>)

    let bucketLatencies: Array<number> = []
    let results: Array<PaymentPrepareResult> = []
    const start = performance.now()

    let bucketIdx = 0
    for (const bucket of prepareBuckets) {
      process.stdout.write(`\rbucket: ${bucketIdx.toLocaleString()}/${prepareBuckets.length.toLocaleString()}`)
      console.clear()

      const startBucket = performance.now()
      const result = await this.harness.ledger.prepare(bucket)
      results.push(...result)
      bucketLatencies.push(performance.now() - startBucket)

      bucketIdx += 1
    }
    process.stdout.write(`\rbucket: ${bucketIdx.toLocaleString()}/${prepareBuckets.length.toLocaleString()}`)
    console.log()

    assert(bucketLatencies.length === prepareBuckets.length)

    const durationMs = performance.now() - start
    const latencies = [...bucketLatencies].sort((a, b) => a - b)

    const resultTypes = results.map(result => result.type)
    const countPass = resultTypes.filter(type => type === PaymentPrepareResultType.PASS).length
    const countFail = resultTypes.filter(type => type !== PaymentPrepareResultType.PASS).length

    this.result = {
      options: this.options,
      durationMs,
      durationsPerBucket: bucketLatencies,
      tpsAvg: this.options.payments / (durationMs / 1000),
      latencyP100: latencies[latencies.length - 1],
      latencyP99: latencies[Math.floor(latencies.length * 0.99)],
      latencyP95: latencies[Math.floor(latencies.length * 0.95)],
      latencyP50: latencies[Math.floor(latencies.length * 0.5)],
      countPass,
      countFail,
    }

    return
  }

  public static makeRandomPayment(harness: Harness, dfsps: Array<string>, currency: string): ApiHelpers.Payment {
    const [payer, payee] = harness.prng.randomSampleFrom(dfsps, 2)
    return ApiHelpers
      .buildPayment()
      .deps(harness)
      .amount("0.01", currency)
      .parties(payer, payee)
      .transferId(harness.prng.uuidv4())
      .build()
  }

  public getResults(): Result {
    assert(this.result, 'this.result is not defined. Did you call run()?')

    return this.result
  }
}