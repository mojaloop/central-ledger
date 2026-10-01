import { describe, it } from "node:test";
import { envOrDefaultNumber } from "../util";
import { ApplicationConfig } from "../../lib/config";
import PRNG from "../prng";
import Harness from "../harness/harness";
import assert from "node:assert";
import { Account, CreateAccountStatus, CreateTransferStatus, id, Transfer } from "tigerbeetle-node";

const seed = envOrDefaultNumber('SEED', Math.floor(Math.random() * 1e8))
const prng = new PRNG(seed)
Harness.injectPrngAndPatchDateGlobal(prng)
const harness = Harness.getInstance()


type Options = {
  transfers: number,
  batchSize: number
}

/**
 * This is a benchmark to assess the single-client performance of tigerbeetle-node.
 */
describe('tigerbeetle benchmark', () => {
  it('Creates transfers with different batch sizes.', async () => {
    let result = await run(
      { transfers: 1_000_000, batchSize: 8189},
      { 
        LEDGER: 'TIGERBEETLE',
        TIGERBEETLE_CLUSTER_ID: 0n,
        TIGERBEETLE_ADDRESSES: ['172.25.0.100:3000,172.25.0.101:3000,172.25.1.100:3000,172.25.1.101:3000,172.25.2.100:3000,172.25.2.101:3000'] 
      }
    )
    printHeading('FULL BATCHES')
    console.log(printResult(result))

    result = await run(
      { transfers: 1_000_000, batchSize: 6250 },
      { 
        LEDGER: 'TIGERBEETLE',
        TIGERBEETLE_CLUSTER_ID: 0n,
        TIGERBEETLE_ADDRESSES: ['172.25.0.100:3000,172.25.0.101:3000,172.25.1.100:3000,172.25.1.101:3000,172.25.2.100:3000,172.25.2.101:3000'] 
      }
    )

    printHeading('ALMOST FULL BATCHES')
    console.log(printResult(result))
  })
})

const printHeading = (heading: string) => {
  console.log(``.padEnd(25, '-') + `${heading}`.padEnd(25, '-'))
}

const run = async (
  options: Options,
  config: Partial<ApplicationConfig>
): Promise<Result> => {
  try {
    await harness.up()
    harness.configOverride(config)
    await harness.setupGlobals()

    const benchmark = new TigerBeetleBenchmark(options, harness)
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

type Result = {
  options: Options
  durationMs: number,
  durationsPerBucket: Array<number>,
  tpsAvg: number,
  latencyP100: number
  latencyP99: number
  latencyP95: number
  latencyP50: number
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
  printer += `transfers=          ${result.options.transfers.toLocaleString()}\n`
  printer += `batchSize=          ${result.options.batchSize.toLocaleString()}\n`
  printer += `durationMs=         ${Math.floor(result.durationMs).toLocaleString()}\n`
  printer += `TPS=                ${Math.floor(result.tpsAvg).toLocaleString()}\n`
  printer += `durationMsBuckets= ${bucketSummary}\n`
  printer += `latencies:\n`
  printer += `  p100           =  ${Math.floor(result.latencyP100)}\n`
  printer += `  p99            =  ${Math.floor(result.latencyP99)}\n`
  printer += `  p95            =  ${Math.floor(result.latencyP95)}\n`
  printer += `  p50            =  ${Math.floor(result.latencyP50)}\n`
  return printer
}


class TigerBeetleBenchmark {
  private result: Result | null = null

  constructor(private options: Options, private harness: Harness) { }

  public async run(): Promise<void> {
    // Create 2 TigerBeetle accounts.
    const idAccountA = id()
    const idAccountB = id()
    const accounts: Array<Account> = [
      {
        id: idAccountA,
        debits_pending: 0n,
        debits_posted: 0n,
        credits_pending: 0n,
        credits_posted: 0n,
        user_data_128: 0n,
        user_data_64: 0n,
        user_data_32: 0,
        reserved: 0,
        ledger: 100,
        code: 1,
        flags: 0,
        timestamp: 0n
      },
      {
        id: idAccountB,
        debits_pending: 0n,
        debits_posted: 0n,
        credits_pending: 0n,
        credits_posted: 0n,
        user_data_128: 0n,
        user_data_64: 0n,
        user_data_32: 0,
        reserved: 0,
        ledger: 100,
        code: 1,
        flags: 0,
        timestamp: 0n
      }
    ]
    const resultCreateAccounts = await this.harness.clientTigerBeetle.createAccounts(accounts)
    resultCreateAccounts.forEach((result, idx) => {
      if (result.status === CreateAccountStatus.created) return
      if (result.status === CreateAccountStatus.exists) return
      throw new Error(`Failed to create account at index: ${idx} with Error: ${CreateAccountStatus[result.status]}`)
    })

    // Create a bunch of transfers in batches of options.batchSize.
    const transfers = Array.from(
      { length: this.options.transfers },
      () => this.randomTransfer([idAccountA, idAccountB])
    )
    const transferBatches = transfers.reduce((acc, transfer, idx) => {
      const idxBatch = Math.floor(idx / this.options.batchSize)
      acc[idxBatch] = acc[idxBatch] || []
      acc[idxBatch].push(transfer)

      return acc
    }, [] as Array<Array<Transfer>>)

    let batchLatencies: Array<number> = []
    const start = performance.now()
    let bucketIdx = 0
    for (const bucket of transferBatches) {
      process.stdout.write(`\rbatch: ${bucketIdx.toLocaleString()}/${transferBatches.length.toLocaleString()}`)
      console.clear()

      const startBucket = performance.now()
      const transfers = transferBatches[bucketIdx]
      const resultCreateTransfers = await this.harness.clientTigerBeetle.createTransfers(transfers)
      resultCreateTransfers.forEach((result, idx) => {
        if (result.status === CreateTransferStatus.created) return
        if (result.status === CreateTransferStatus.exists) return
        throw new Error(`Failed to create transfer at index: ${idx} with Error: ${CreateTransferStatus[result.status]}`)
      })

      batchLatencies.push(performance.now() - startBucket)
      bucketIdx += 1
    }
    process.stdout.write(`\rbatch: ${bucketIdx.toLocaleString()}/${transferBatches.length.toLocaleString()}`)
    console.log()

    assert(batchLatencies.length === transferBatches.length)

    const durationMs = performance.now() - start
    const latencies = [...batchLatencies].sort((a, b) => a - b)

    this.result = {
      options: this.options,
      durationMs,
      durationsPerBucket: batchLatencies,
      tpsAvg: this.options.transfers / (durationMs / 1000),
      latencyP100: latencies[latencies.length - 1],
      latencyP99: latencies[Math.floor(latencies.length * 0.99)],
      latencyP95: latencies[Math.floor(latencies.length * 0.95)],
      latencyP50: latencies[Math.floor(latencies.length * 0.5)],
    }
    return
  }

  public getResults(): Result {
    assert(this.result, 'Did you call run()?')
    return this.result
  }

  private randomTransfer(accountIds: Array<bigint>): Transfer {
    assert(accountIds.length >= 2)
    const [debit, credit] = this.harness.prng.randomSampleFrom(accountIds, 2)
    return {
      id: id(),
      debit_account_id: debit,
      credit_account_id: credit,
      amount: 0n,
      pending_id: 0n,
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      timeout: 0,
      ledger: 100,
      code: 1,
      flags: 0,
      timestamp: 0n
    }
  }
}