import { describe, it } from "node:test"
import fs from "node:fs"
import path from 'path'
import LoggerMock from "../../testing/logger-mock"
import { logger as loggerGlobal } from "../../shared/logger"
// @ts-ignore  Override the globally exported logger. Note that we MUST do this before
// we import Harness, which imports the globals.
loggerGlobal = new LoggerMock()
import Harness from "../../testing/harness/harness"
import { loggerFactory } from "@mojaloop/central-services-logger/src/contextLogger"
import { envOrDefaultNumber, sanitizeTestName } from "../../testing/util"
import { Server } from "@hapi/hapi"
import * as ApiHelpers from '../../testing/api-helpers'
import Trace from "../../testing/fuzz/trace"
import assert from "node:assert"
import PRNG from "../../testing/prng"
import { ApplicationConfig } from "../../lib/config"
import {
  CloseSettlementWindowResult,
  CreateDfspCommand,
  CreateHubAccountCommand,
  DepositCommand,
  DisableDfspAccountCommand,
  EnableDfspAccountCommand,
  GetAllDfspAccountsQuery,
  GetDfspAccountsQuery,
  GetHubAccountsQuery,
  GetNetDebitCapQuery,
  GetNetDebitCapsQuery,
  GetSettlementQuery,
  GetSettlementsQuery,
  GetSettlementWindowQuery,
  GetSettlementWindowsQuery,
  Ledger,
  LookupTransferQuery,
  SetNetDebitCapCommand,
  Settlement,
  SettlementAbortCommand,
  SettlementCloseWindowCommand,
  SettlementPrepareCommand,
  SettlementUpdateCommand,
  WithdrawAbortCommand,
  WithdrawCommitCommand,
  WithdrawPrepareCommand
} from "../ledger/types"
import { PaymentPrepareResultType, PrepareHandlerInput } from "../../handlers/payment-prepare"
import { FulfilHandlerInput } from "../../handlers/payment-fulfil"
import { exist } from "joi"
import db from "../../lib/db"

const logger = loggerFactory()

// We need to patch the date globally before starting the harness.
// This is quite annoying since it means we can't change easily change the seed in between runs.
const seed = envOrDefaultNumber('SEED', Math.floor(Math.random() * 1e8))
const prng = new PRNG(seed)
Harness.injectPrngAndPatchDateGlobal(prng)
const harness = Harness.getInstance()

const filename = path.basename(__filename)
assert(filename)

describe('Ledger Fuzz', () => {
  it('runs the fuzzer', async (context) => {
    const stepsMax = envOrDefaultNumber('STEPS_MAX', 1000)
    const trace = await run(stepsMax, { API_MODE_SETTLEMENT: 'LEDGER' })

    const dirTrace = `.fuzz_output/${filename}/${sanitizeTestName(context.name)}`
    const pathTrace = `${dirTrace}/trace.txt`
    fs.mkdirSync(dirTrace, { recursive: true });
    fs.writeFileSync(pathTrace, trace.toString())
    console.log(`Fuzz trace written to ${pathTrace}.`)
  })

  // TODO: need to implement LederTigerBeetle
  it.skip('LedgerSql and LedgerTigerBeetle are identical', async (context) => {
    const stepsMax = envOrDefaultNumber('STEPS_MAX', 1000)
    const traceA = await run(stepsMax, { API_MODE_SETTLEMENT: 'NONE' })
    const traceB = await run(stepsMax, { API_MODE_SETTLEMENT: 'LEDGER' })

    const pathBase = `.fuzz_output/${filename}/${sanitizeTestName(context.name)}`
    fs.mkdirSync(pathBase, { recursive: true });
    const pathA = `${pathBase}/traceA.txt`
    const pathB = `${pathBase}/traceB.txt`

    fs.writeFileSync(pathA, traceA.toString())
    fs.writeFileSync(pathB, traceB.toString())

    console.log(`Fuzz trace written to ${pathBase}.`)
    console.log(`Compare the two files with:\n\tgit diff --no-index ${pathA} ${pathB}`)

    traceA.compare(traceB, { nameLeft: 'REFACTOR=false', nameRight: 'REFACTOR=true', seed })
  })

  it('is fully deterministic', async (context) => {
    const stepsMax = envOrDefaultNumber('STEPS_MAX', 2000)
    const traceA = await run(stepsMax, {})
    const traceB = await run(stepsMax, {})

    const filename = path.basename(__filename)
    assert(filename)
    const pathBase = `.fuzz_output/${filename}/${sanitizeTestName(context.name)}`
    fs.mkdirSync(pathBase, { recursive: true });
    const pathA = `${pathBase}/traceA.txt`
    const pathB = `${pathBase}/traceB.txt`

    fs.writeFileSync(pathA, traceA.toString())
    fs.writeFileSync(pathB, traceB.toString())

    console.log(`Fuzz trace written to ${pathBase}.`)
    console.log(`Compare the two files with:\n\tgit diff --no-index ${pathA} ${pathB}`)

    traceA.compare(traceB, { nameLeft: 'traceA', nameRight: 'traceB', seed })
  })
})

const run = async (stepsMax: number, config: Partial<ApplicationConfig>): Promise<Trace> => {
  harness.clock.reset()
  harness.prng.reset()

  try {
    const options: FuzzOptions = { stepsMax }
    await harness.up()
    await harness.setupGlobals()
    harness.configOverride(config)

    // Temporarily patch the database schema to get rid of default dates, making it easy to find
    // where we are setting them!
    const Db = await import('../../lib/db')
    const knex = Db._knex
    await knex.raw(`ALTER TABLE transfer MODIFY COLUMN createdDate datetime NOT NULL;`)
    await knex.raw(`ALTER TABLE transferStateChange MODIFY COLUMN createdDate datetime NOT NULL;`)
    await knex.raw(`ALTER TABLE transferDuplicateCheck MODIFY COLUMN createdDate datetime NOT NULL;`)
    await knex.raw(`ALTER TABLE transferError MODIFY COLUMN createdDate datetime NOT NULL;`)
    await knex.raw(`ALTER TABLE transferErrorDuplicateCheck MODIFY COLUMN createdDate datetime NOT NULL;`)
    await knex.raw(`ALTER TABLE transferFulfilment MODIFY COLUMN createdDate datetime NOT NULL;`)

    const fuzzer = new LedgerFuzzer(options, harness)
    await fuzzer.run()

    return fuzzer.trace
  } catch (err: any) {
    logger.error(err.message)
    logger.error(err.stack)
    throw err
  } finally {
    await harness.teardownGlobals()
    await harness.down()
  }
}

type ActionName =
  // Lifecycle Methods.
  | 'createHubAccount'
  | 'createDfsp'
  | 'disableDfsp'
  | 'enableDfsp'
  | 'enableDfspAccount'
  | 'disableDfspAccount'
  | 'deposit'
  | 'withdrawPrepare'
  | 'withdrawCommit'
  | 'withdrawAbort'
  | 'setNetDebitCap'
  | 'getHubAccounts'
  | 'getDfsp'
  | 'getAllDfsps'
  | 'getDfspAccounts'
  | 'getAllDfspAccounts'
  | 'getNetDebitCap'
  | 'getNetDebitCaps'

  // Clearing Methods.
  | 'prepare'
  | 'fulfil'
  | 'sweepTimedOut'
  | 'lookupTransfer'

  // Settlement Methods.
  | 'closeSettlementWindow'
  | 'settlementPrepare'
  | 'settlementAbort'
  | 'settlementCommit'
  | 'settlementUpdate'
  | 'getSettlementWindows'
  | 'getSettlementWindow'
  | 'getSettlement'
  | 'getSettlements'

interface FuzzOptions {
  /**
   * How many steps the fuzzer should take.
   */
  stepsMax: number,
}

class LedgerFuzzer {
  private step = 1
  private readonly stepsMax: number
  private _trace = new Trace()

  // Keep track of these fields for less randomness.
  private registeredCurrencies: Array<string> = []
  private registeredDfspIds: Record<string, true> = {}
  private registeredDfsps: Array<string> = []
  private dfspAccountIds: Array<number> = []
  private withdrawIds: Record<string, true> = {}
  private withdraws: Array<any> = []
  private transferIds: Record<string, true> = {}
  private prepareIdsSuccess: Record<string, true> = {}

  private abortedIds: Record<string, true> = {}
  private payments: Array<ApiHelpers.Payment> = []
  private settlementIds: Record<number, true> = {}
  private settlements: Array<Settlement> = []


  private ledger: Ledger
  private prng: PRNG

  private weights: Record<ActionName, number> = {
    createHubAccount: 5,
    createDfsp: 5,
    disableDfsp: 2,
    enableDfsp: 5,
    enableDfspAccount: 5,
    disableDfspAccount: 2,
    deposit: 4,
    withdrawPrepare: 5,
    withdrawCommit: 5,
    withdrawAbort: 5,
    setNetDebitCap: 5,
    getHubAccounts: 5,
    getDfsp: 1,
    getAllDfsps: 1,
    getDfspAccounts: 1,
    getAllDfspAccounts: 1,
    getNetDebitCap: 1,
    getNetDebitCaps: 1,
    prepare: 1,
    fulfil: 1,
    sweepTimedOut: 1,
    lookupTransfer: 1,
    closeSettlementWindow: 2,
    settlementPrepare: 2,
    settlementAbort: 2,
    settlementCommit: 2,
    settlementUpdate: 2,
    getSettlementWindows: 1,
    getSettlementWindow: 1,
    getSettlement: 1,
    getSettlements: 1
  }

  constructor(
    private options: FuzzOptions,
    private harness: Harness,
  ) {
    assert(options.stepsMax)
    this.stepsMax = options.stepsMax
    this.ledger = harness.ledger
    this.prng = harness.prng
  }

  public async run() {
    logger.warn(`LedgerFuzzer.run() running:`)
    logger.warn(`\tSEED      = ${this.harness.seed}`)
    logger.warn(`\tSTEPS_MAX = ${this.stepsMax} `)

    try {
      while (this.step <= this.stepsMax) {
        await this.doStep()
        this.harness.clock.tick()

        this.step += 1
      }
    } catch (err: any) {
      logger.error(`LedgerFuzzer.run() died on step: ${this.step}.`)
      logger.error(`Error: ${err.message}\nStack: ${err.stack}`)
      logger.error(`LedgerFuzzer.run() rerun with SEED=${this.harness.seed}`)
      throw err
    }
  }

  get trace() {
    return this._trace
  }

  private async doStep() {
    return this.randomAction()()
  }

  private actions: Record<ActionName, () => Promise<void>> = {
    createHubAccount: () => this.createHubAccount(),
    createDfsp: () => this.createDfsp(),
    disableDfsp: () => this.disableDfsp(),
    enableDfsp: () => this.enableDfsp(),
    enableDfspAccount: () => this.enableDfspAccount(),
    disableDfspAccount: () => this.disableDfspAccount(),
    deposit: () => this.deposit(),
    withdrawPrepare: () => this.withdrawPrepare(),
    withdrawCommit: () => this.withdrawCommit(),
    withdrawAbort: () => this.withdrawAbort(),
    setNetDebitCap: () => this.setNetDebitCap(),
    getHubAccounts: () => this.getHubAccounts(),
    getDfsp: () => this.getDfsp(),
    getAllDfsps: () => this.getAllDfsps(),
    getDfspAccounts: () => this.getDfspAccounts(),
    getAllDfspAccounts: () => this.getAllDfspAccounts(),
    getNetDebitCap: () => this.getNetDebitCap(),
    getNetDebitCaps: () => this.getNetDebitCaps(),
    prepare: () => this.prepare(),
    fulfil: () => this.fulfil(),
    sweepTimedOut: () => this.sweepTimedOut(),
    lookupTransfer: () => this.lookupTransfer(),
    closeSettlementWindow: () => this.closeSettlementWindow(),
    settlementPrepare: () => this.settlementPrepare(),
    settlementAbort: () => this.settlementAbort(),
    settlementCommit: () => this.settlementCommit(),
    settlementUpdate: () => this.settlementUpdate(),
    getSettlementWindows: () => this.getSettlementWindows(),
    getSettlementWindow: () => this.getSettlementWindow(),
    getSettlement: () => this.getSettlement(),
    getSettlements: () => this.getSettlements(),
  }

  private randomAction(): () => Promise<void> {
    const table = PRNG.generateWeightedChoiceTable<ActionName>(this.weights)
    const action = this.harness.prng.randomElementFrom(table)
    return this.actions[action]
  }

  private traceResult(action: ActionName, input: any, output: any) {
    this.trace.push({
      step: this.step,
      action,
      path: '',
      payload: input,
      code: 0,
      body: output,
      prngCalls: this.harness.prng.callCount
    })
  }

  private async createHubAccount(): Promise<void> {
    const accountType = this.prng.coin() ? this.randomAccountType() : undefined
    const currency = this.randomCurrency()

    const cmd: CreateHubAccountCommand = {
      currency,
      settlementModel: this.defaultSettlementModel(currency)
    }
    if (accountType) {
      cmd.accountType = accountType
    }
    const result = await this.ledger.createHubAccount(cmd)
    this.traceResult('createHubAccount', cmd, result)

    if (result.type === 'SUCCESS') this.registeredCurrencies.push(currency)

    if (this.registeredCurrencies.length >= 4) {
      // No more need to create hub accounts.
      this.weights.createHubAccount = 0
    }
  }

  private async createDfsp(): Promise<void> {
    const name = this.randomDfspName()
    const currency = this.randomCurrency()

    const cmd: CreateDfspCommand = {
      dfspId: name,
      isProxy: this.prng.randomElementWeighted([false, true], [8, 2]),
      currencies: [
        currency
      ]
    }
    if (this.prng.intExclusive(100) > 80) {
      cmd.currencies.push(this.randomCurrency())
    }
    const result = await this.ledger.createDfsp(cmd)
    this.traceResult('createDfsp', cmd, result)

    if (result.type === 'SUCCESS' && !this.registeredDfspIds[name]) {
      this.registeredDfspIds[name] = true
      this.registeredDfsps.push(name)
    }

    // console.log(`createDfsp`, cmd.dfspId, cmd.currencies)
    if (this.registeredDfsps.length >= 5) {
      this.weights.prepare = 15
      this.weights.fulfil = 15
    }

    if (this.registeredDfsps.length >= 50) {
      // No more need to more dfsps.
      this.weights.createDfsp = 0
    }
  }

  private async disableDfsp(): Promise<void> {
    const name = this.randomDfspName()

    const cmd = { dfspId: name }
    const result = await this.ledger.disableDfsp(cmd)
    this.traceResult('disableDfsp', cmd, result)
  }

  private async enableDfsp(): Promise<void> {
    const name = this.randomDfspName()

    const cmd = {
      dfspId: name
    }
    const result = await this.ledger.enableDfsp(cmd)
    this.traceResult('enableDfsp', cmd, result)
  }

  private async enableDfspAccount(): Promise<void> {
    const name = this.randomDfspName()
    const accountId = this.randomDfspAccount()

    const cmd: EnableDfspAccountCommand = {
      dfspId: name,
      accountId,
    }
    const result = await this.ledger.enableDfspAccount(cmd)
    this.traceResult('enableDfspAccount', cmd, result)
  }

  private async disableDfspAccount(): Promise<void> {
    const name = this.randomDfspName()
    const accountId = this.randomDfspAccount()

    const cmd: DisableDfspAccountCommand = {
      dfspId: name,
      accountId,
    }
    const result = await this.ledger.disableDfspAccount(cmd)
    this.traceResult('disableDfspAccount', cmd, result)
  }

  private async deposit(): Promise<void> {
    const name = this.randomDfspName()
    const cmd: DepositCommand = {
      dfspId: name,
      transferId: this.prng.uuidv4(),
      currency: this.randomCurrency(),
      amount: this.prng.intExclusive(100000),
      reason: this.prng.randomString()
    }
    const result = await this.ledger.deposit(cmd)
    this.traceResult('deposit', cmd, result)
  }

  private async withdrawPrepare(): Promise<void> {
    const name = this.randomDfspName()
    let cmd: WithdrawPrepareCommand = {
      dfspId: name,
      transferId: this.prng.uuidv4(),
      currency: this.randomCurrency(),
      amount: this.prng.intExclusive(100000),
      reason: this.prng.randomString()
    }

    if (this.withdraws.length > 0 && this.prng.coin()) {
      // Reuse an existing one.
      cmd = this.prng.randomElementFrom(this.withdraws)

      // Maybe mutate.
      if (this.prng.coin()) {
        cmd.reason = this.prng.randomString()
      }
    }

    const result = await this.ledger.withdrawPrepare(cmd)
    this.traceResult('withdrawPrepare', cmd, result)

    if (!this.withdrawIds[cmd.transferId]) {
      this.withdrawIds[cmd.transferId] = true
      this.withdraws.push(cmd)
    }
  }

  private async withdrawCommit(): Promise<void> {
    const cmd: WithdrawCommitCommand = {
      transferId: this.randomWithdawId()
    }
    const result = await this.ledger.withdrawCommit(cmd)
    this.traceResult('withdrawCommit', cmd, result)
  }

  private async withdrawAbort(): Promise<void> {
    const cmd: WithdrawAbortCommand = {
      transferId: this.randomWithdawId()
    }
    const result = await this.ledger.withdrawAbort(cmd)
    this.traceResult('withdrawAbort', cmd, result)
  }

  private async setNetDebitCap(): Promise<void> {
    let cmd: SetNetDebitCapCommand = {
      netDebitCapType: 'LIMITED',
      dfspId: this.randomDfspName(),
      currency: this.randomCurrency(),
      amount: this.prng.intExclusive(100_000),
      alarmPercentage: this.prng.intExclusive(100),
    }

    const result = await this.ledger.setNetDebitCap(cmd)
    this.traceResult('setNetDebitCap', cmd, result)
  }

  private async getHubAccounts(): Promise<void> {
    const result = await this.ledger.getHubAccounts({})
    this.traceResult('getHubAccounts', {}, result)
  }

  private async getDfsp(): Promise<void> {
    const query = {
      dfspId: this.randomDfspName()
    }
    const result = await this.ledger.getDfsp(query)
    this.traceResult('getDfsp', {}, result)
  }

  private async getAllDfsps(): Promise<void> {
    const result = await this.ledger.getAllDfsps({})
    this.traceResult('getAllDfsps', {}, result)
  }

  private async getDfspAccounts(): Promise<void> {
    const query: GetDfspAccountsQuery = {
      dfspId: this.randomDfspName(),
      currency: this.randomCurrency()
    }
    const result = await this.ledger.getDfspAccounts(query)
    this.traceResult('getDfspAccounts', query, result)
  }

  private async getAllDfspAccounts(): Promise<void> {
    const query: GetAllDfspAccountsQuery = {
      dfspId: this.randomDfspName(),
    }
    const result = await this.ledger.getAllDfspAccounts(query)
    this.traceResult('getAllDfspAccounts', query, result)
  }

  private async getNetDebitCap(): Promise<void> {
    const query: GetNetDebitCapQuery = {
      dfspId: this.randomDfspName(),
      currency: this.randomCurrency()
    }
    const result = await this.ledger.getNetDebitCap(query)
    this.traceResult('getNetDebitCap', query, result)
  }

  private async getNetDebitCaps(): Promise<void> {
    const query: GetNetDebitCapsQuery = {
      dfspId: this.randomDfspName(),
    }
    const result = await this.ledger.getNetDebitCaps(query)
    this.traceResult('getNetDebitCaps', query, result)
  }

  private async prepare(): Promise<void> {
    const prepares: Array<PrepareHandlerInput> = Array(1).fill(this.makePrepare())
    const result = await this.ledger.prepare(prepares)
    this.traceResult('prepare', prepares, result)

    result.forEach((prepareResult, idx) => {
      const prepare = prepares[idx]
      if (prepareResult.type === PaymentPrepareResultType.PASS) {
        this.prepareIdsSuccess[prepare.transferId] = true
      }
    })
  }

  private async fulfil(): Promise<void> {
    const fulfills: Array<FulfilHandlerInput> = Array(1).fill(this.makeFulfilOrAbort())
    const result = await this.ledger.fulfil(fulfills)
    this.traceResult('fulfil', fulfills, result)
  }

  private makePrepare(): PrepareHandlerInput {
    // Maybe grab an existing payment.
    if (this.payments.length > 0 && this.prng.intExclusive(100) > 96) {
      return this.prng.randomElementFrom(this.payments).toPrepare()
    }

    // Maybe mutate a payment.
    if (this.payments.length > 0 && this.prng.intExclusive(100) > 96) {
      return this.mutatePrepare(this.prng.randomElementFrom(this.payments))
    }

    const payment = ApiHelpers.buildPayment()
      .deps(this.harness)
      .transferId(this.prng.uuidv4())
      .parties(this.randomDfspName(), this.randomDfspName())
      .amount(this.randomAmount())
      .expiry(this.prng.intExclusive(500))
      .build()

    if (!this.transferIds[payment.getOptions().transferId]) {
      this.transferIds[payment.getOptions().transferId] = true
      this.payments.push(payment)
    }

    return payment.toPrepare()
  }

  private mutatePrepare(payment: ApiHelpers.Payment): PrepareHandlerInput {
    const mutation = this.prng.randomElementWeighted([
      'invalidIlpPacket', 'swapSrcDest', 'changeCurrency', 'changeAmount'
    ], [1, 1, 1, 1])
    const prepare = payment.toPrepare()
    switch (mutation) {
      case 'invalidIlpPacket': {
        prepare.payload.ilpPacket = this.prng.randomString()
        return prepare
      }
      case 'swapSrcDest': {
        const cloned = structuredClone(prepare.headers)
        prepare.headers['fspiop-source'] = cloned['fspiop-destination']
        prepare.headers['fspiop-destination'] = cloned['fspiop-source']
        return prepare
      }
      case 'changeCurrency':
        prepare.payload.amount.currency = this.randomCurrency()
        return prepare
      case 'changeAmount':
        prepare.payload.amount.amount = this.randomAmount()
        return prepare
    }

    throw new Error(`mutatePrepare() - unsupported mutation: ${mutation}`)
  }

  private makeFulfilOrAbort() {
    return this.prng.coin() ? this.makeFulfil() : this.makeAbort()
  }

  private makeFulfil(): FulfilHandlerInput {
    let payment: ApiHelpers.Payment

    // Low chance of fulfilling an aborted payment.
    if (Object.keys(this.abortedIds).length > 0 && this.prng.intExclusive(100) > 95) {
      const abortedId = this.prng.randomElementFrom(Object.keys(this.abortedIds))
      const paymentAborted = this.payments
        .find(payment => payment.getOptions().transferId === abortedId)
      assert(paymentAborted, `No aborted payment found for id: ${abortedId}.`)

      return paymentAborted.toFulfil(this.prng.randomElementFrom(['COMMITTED', 'RESERVED']))
    }

    // Get a payment that was prepared succesfully.
    if (Object.keys(this.prepareIdsSuccess).length > 0 && this.prng.intExclusive(100) > 5) {
      const id = this.prng.randomElementFrom(Object.keys(this.prepareIdsSuccess))
      const payment = this.payments.find(payment => payment.getOptions().transferId === id)
      assert(payment, `Could not find existing payment for succesfully preparedId: ${id}.`)

      return payment.toFulfil(this.prng.randomElementFrom(['COMMITTED', 'RESERVED']))
    } 

    // High chance of getting an existing payment.
    if (this.payments.length > 0 && this.prng.intExclusive(100) > 5) {
      payment = this.prng.randomElementFrom(this.payments)
    } else {
      // Make up a new payment.
      payment = ApiHelpers.buildPayment()
        .deps(this.harness)
        .transferId(this.prng.uuidv4())
        .parties(this.randomDfspName(), this.randomDfspName())
        .amount(this.randomAmount())
        .expiry(this.prng.intExclusive(500))
        .build()
    }

    if (this.prng.intExclusive(100) > 95) {
      return this.mutateFulfil(payment)
    }

    return payment.toFulfil(this.prng.randomElementFrom(['COMMITTED', 'RESERVED']))
  }

  private makeAbort() {
    let payment: ApiHelpers.Payment
    // High chance of getting an existing payment.
    if (this.payments.length > 0 && this.prng.intExclusive(100) > 5) {
      payment = this.prng.randomElementFrom(this.payments)
    } else {
      // Make up a new payment.
      payment = ApiHelpers.buildPayment()
        .deps(this.harness)
        .transferId(this.prng.uuidv4())
        .parties(this.randomDfspName(), this.randomDfspName())
        .amount(this.randomAmount())
        .expiry(this.prng.intExclusive(500))
        .build()
    }

    const id = payment.getOptions().transferId
    if (!this.transferIds[id]) {
      this.abortedIds[id] = true
      this.payments.push(payment)
      this.transferIds[id] = true
    }

    if (this.prng.intExclusive(100) > 75) {
      return this.mutateAbort(payment)
    }

    return payment.toAbort()
  }

  private mutateFulfil(payment: ApiHelpers.Payment): FulfilHandlerInput {
    const mutation = this.prng.randomElementWeighted([
      'invalidFulfilment', 'swapSrcDest', 'changeId', 'changeDate'
    ], [1, 1, 1, 1])
    const fulfil = payment.toFulfil(this.prng.randomElementFrom(['COMMITTED', 'RESERVED']))
    assert(fulfil.payload.transferState !== 'ABORTED')
    switch (mutation) {
      case 'invalidFulfilment': {
        fulfil.payload.fulfilment = this.prng.randomString()
        return fulfil
      }
      case 'swapSrcDest': {
        const cloned = structuredClone(fulfil)
        fulfil.callerDfspId = cloned.destinationDfspId
        fulfil.destinationDfspId = cloned.callerDfspId
        return fulfil
      }
      case 'changeId':
        fulfil.transferId = this.randomTransferId()
        return fulfil
      case 'changeDate':
        fulfil.payload.completedTimestamp = (new Date()).toISOString()
        return fulfil
    }

    throw new Error(`mutateFulfil() - unsupported mutation: ${mutation}`)
  }

  private mutateAbort(payment: ApiHelpers.Payment): FulfilHandlerInput {
    const abort = payment.toAbort()
    assert(abort.payload.transferState === 'ABORTED')
    abort.payload.errorInformation = this.prng.mutateObject(abort.payload.errorInformation)
    return abort
  }

  private async sweepTimedOut(): Promise<void> {
    const now = this.harness.clock.now
    const result = await this.ledger.sweepTimedOut(now)
    this.traceResult('sweepTimedOut', now, result)
  }

  private async closeSettlementWindow(): Promise<void> {
    let windowId
    try {
      const windows = await ApiHelpers.getOpenSettlementWindows(harness)
      windowId = this.harness.prng.randomElementWeighted([
        this.harness.prng.randomElementFrom(windows.map(window => window.settlementWindowId)),
        this.harness.prng.intExclusive(100)
      ], [4, 1])
    } catch (err: any) {
      logger.warn('failed to get open settlement window', err.message)
      // Ignoring error, just get a random id.
      windowId = this.harness.prng.intExclusive(100)
    }
    const cmd: SettlementCloseWindowCommand = {
      id: windowId,
      now: this.harness.clock.now,
      reason: this.harness.prng.randomString()
    }

    const result = await this.ledger.closeSettlementWindow(cmd)
    this.traceResult('closeSettlementWindow', cmd, result)
  }

  private async settlementPrepare(): Promise<void> {
    const windows = (await ApiHelpers.getSettlementWindows(harness))
      .filter(window => window.state === 'CLOSED')


    if (windows.length === 0 && this.harness.prng.coin()) {
      // Don't bother trying if we don't have a closed window, so just close a window.
      await this.closeSettlementWindow()
      return
    }

    let windowIds: Array<number> = []
    if (windows.length > 0) {
      windowIds = this.harness.prng.randomSampleFrom(
        windows.map(window => window.settlementWindowId),
        this.harness.prng.intExclusive(windows.length + 1)
      )
    }

    const cmd: SettlementPrepareCommand = {
      model: `DEFERRED_MULTILATERAL_NET_${this.randomCurrency()}`,
      reason: this.harness.prng.randomString(),
      windowIds,
      now: this.harness.clock.now,
    }

    const result = await this.ledger.settlementPrepare(cmd)
    this.traceResult('settlementPrepare', cmd, result)

    if (result.type === 'SUCCESS') {
      this.settlementIds[result.result.id] = true
      const settlement = await ApiHelpers.getSettlement(this.harness, result.result.id)
      this.settlements.push(settlement as unknown as Settlement)
    }
  }

  private async settlementAbort(): Promise<void> {
    const settlementIds = Object.keys(this.settlementIds)

    if (settlementIds.length === 0 && this.prng.intExclusive(101) > 99) {
      return
    }

    let settlementId = this.harness.prng.intExclusive(1000)
    if (settlementIds.length > 0) {
      settlementId = Number.parseInt(this.harness.prng.randomElementFrom(settlementIds))
    }
    const cmd: SettlementAbortCommand = {
      id: settlementId,
      reason: this.harness.prng.randomString(),
    }

    const result = await this.ledger.settlementAbort(cmd)
    this.traceResult('settlementAbort', cmd, result)
  }

  private async settlementCommit(): Promise<void> {
    const result = await this.ledger.settlementCommit({})
    this.traceResult('settlementCommit', {}, result)
  }

  private async settlementUpdate(): Promise<void> {
    const settlementIds = Object.keys(this.settlementIds)

    if (settlementIds.length === 0 && this.prng.intExclusive(101) > 99) {
      return
    }

    let settlementId = this.harness.prng.intExclusive(1000)
    let participantId = this.harness.prng.intExclusive(1000)
    let accountId = this.harness.prng.intExclusive(1000)
    if (this.settlements.length > 0 && this.harness.prng.intExclusive(100) < 98) {
      const settlement = this.harness.prng.randomElementFrom(this.settlements)
      settlementId = settlement.id

      const participant = this.harness.prng.randomElementFrom(settlement.participants)
      participantId = participant.id
      assert(participant.accounts.length > 0, 'Expected participant to have at least one account.')
      accountId = this.harness.prng.randomElementFrom(participant.accounts).id
    }

    if (settlementIds.length > 0) {
      settlementId = Number.parseInt(this.harness.prng.randomElementFrom(settlementIds))
    }
    const cmd = {
      id: settlementId,
      updates: [{
        participantId,
        accountId,
        participantState: this.randomSettlementTransferState(),
        reason: this.prng.randomString(),
        externalReference: this.prng.randomString(),
      }]
    } as SettlementUpdateCommand

    const result = await this.ledger.settlementUpdate(cmd)
    this.traceResult('settlementUpdate', cmd, result)
  }

  private async getSettlementWindows(): Promise<void> {
    const generators: Record<string, () => string> = {
      participantId: () => this.harness.prng.intExclusive(100).toString(),
      state: () => this.randomSettlementWindowState(),
      fromDateTime: () => this.randomDateTime(),
      toDateTime: () => this.randomDateTime(),
      currency: () => this.randomCurrency(),
    }

    const keys = Object.keys(generators)
    const paramsCount = this.harness.prng.randomElementWeighted([0, 1, 2, 3, 4], [5, 15, 3, 2, 1])
    const keysSelected = this.harness.prng.randomSampleFrom(keys, paramsCount)
    const query: Record<string, any> = {}
    keysSelected.forEach(key => query[key] = generators[key]())

    const result = await this.ledger.getSettlementWindows(query as GetSettlementWindowsQuery)
    this.traceResult('getSettlementWindows', query, result)
  }

  private async getSettlementWindow(): Promise<void> {
    const id = this.harness.prng.intExclusive(100)
    const query: GetSettlementWindowQuery = { id }
    const result = await this.ledger.getSettlementWindow(query)
    this.traceResult('getSettlementWindow', query, result)
  }

  private async getSettlement(): Promise<void> {
    let id = this.harness.prng.intExclusive(100)
    if (Object.keys(this.settlementIds).length > 0 && this.harness.prng.coin()) {
      id = Number.parseInt(this.harness.prng.randomElementFrom(Object.keys(this.settlementIds)))
    }

    const query: GetSettlementQuery = { id }
    const result = await this.ledger.getSettlement(query)
    this.traceResult('getSettlement', query, result)    

    if (result.type === 'SUCCESS') {
      if (!this.settlementIds[id]) {
        this.settlementIds[id] = true
        this.settlements.push(result.result)
      }
    }
  }

  private async getSettlements(): Promise<void> {
    const generators: Record<string, () => string> = {
      currency: () => this.randomCurrency(),
      state: () => this.randomSettlementState(),
      participantId: () => this.harness.prng.intExclusive(100).toString(),
      accountId: () => this.harness.prng.intExclusive(100).toString(),
      settlementWindowId: () => this.harness.prng.intExclusive(100).toString(),
      fromDateTime: () => this.randomDateTime(),
      toDateTime: () => this.randomDateTime(),
      fromSettlementWindowDateTime: () => this.randomDateTime(),
      toSettlementWindowDateTime: () => this.randomDateTime(),
    }

    const keys = Object.keys(generators)
    const paramsCount = this.harness.prng.randomElementWeighted([0, 1, 2, 3, 4], [5, 15, 3, 2, 1])
    const keysSelected = this.harness.prng.randomSampleFrom(keys, paramsCount)
    const query: Record<string, any> = {}
    keysSelected.forEach(key => query[key] = generators[key]())

    const result = await this.ledger.getSettlements(query as GetSettlementsQuery)
    this.traceResult('getSettlements', query, result)

    if (result.type === 'SUCCESS') {
      for (const settlement of result.result) {
        if (!this.settlementIds[settlement.id]) {
          this.settlementIds[settlement.id] = true
          this.settlements.push(settlement)
        }
      }
    }
  }

  // Helpers.

  private async lookupTransfer(): Promise<void> {
    const query: LookupTransferQuery = {
      transferId: this.randomTransferId()
    }
    const result = await this.ledger.lookupTransfer(query)
    this.traceResult('lookupTransfer', query, result)
  }

  private randomDfspName(): string {
    if (this.registeredDfsps.length > 0 && this.harness.prng.intExclusive(100) > 20) {
      // Reuse.
      return this.harness.prng.randomElementFrom(this.registeredDfsps)
    }

    const name = `dfsp_${this.harness.prng.randomString(this.harness.prng.intInRange(1, 5))}`
    return name
  }

  private randomWithdawId(): string {
    if (Object.keys(this.withdrawIds).length > 0 && this.harness.prng.intExclusive(100) > 20) {
      // Reuse.
      return this.harness.prng.randomElementFrom(Object.keys(this.withdrawIds))
    }

    return this.prng.uuidv4()
  }

  private randomTransferId(): string {
    if (this.payments.length > 0 && this.harness.prng.intExclusive(100) > 20) {
      // Reuse.
      const payment = this.harness.prng.randomElementFrom(this.payments)
      return payment.getOptions().transferId
    }

    return this.prng.uuidv4()
  }

  private randomDfspAccount(): number {
    if (this.dfspAccountIds.length > 0 && this.harness.prng.intExclusive(100) > 20) {
      // Reuse.
      return this.harness.prng.randomElementFrom(this.dfspAccountIds)
    }

    return this.prng.intExclusive(1000)
  }

  private randomCurrency(): string {
    if (this.registeredCurrencies.length > 0 && this.harness.prng.coin()) {
      return this.harness.prng.randomElementFrom(this.registeredCurrencies)
    }

    return this.harness.prng.randomElementWeighted(
      ['USD', 'AUD', 'EUR', 'GBP', this.prng.randomString(3)],
      [10, 10, 5, 5, 10]
    )
  }

  private randomAmount(): string {
    let left = String(this.harness.prng.intInRange(0, 9999)).padStart(2, '0')
    let right = String(this.harness.prng.intInRange(0, 99)).padStart(2, '0')

    return `${left}.${right}`
  }

  private randomAccountType(): string {
    return this.prng.randomElementWeighted([
      `HUB_MULTILATERAL_SETTLEMENT`,
      `HUB_RECONCILIATION`,
      `HUB_FEE`,
      `POSITION`,
      `SETTLEMENT`,
    ], [3, 3, 3, 1, 1])
  }

  private defaultSettlementModel(currency: string) {
    return {
      name: `DEFERRED_MULTILATERAL_NET_${currency}`,
      settlementGranularity: "NET",
      settlementInterchange: "MULTILATERAL",
      settlementDelay: "DEFERRED",
      currency,
      requireLiquidityCheck: true,
      ledgerAccountType: "POSITION",
      settlementAccountType: "SETTLEMENT",
      autoPositionReset: true
    }
  }

  private randomSettlementState(): string {
    return this.harness.prng.randomElementFrom([
      'PENDING_SETTLEMENT',
      'PS_TRANSFERS_RECORDED',
      'PS_TRANSFERS_RESERVED',
      'PS_TRANSFERS_COMMITTED',
      'SETTLING',
      'SETTLED',
      'ABORTED',
    ])
  }

  private randomSettlementWindowState(): string {
    return this.harness.prng.randomElementFrom([
      "OPEN",
      "CLOSED",
      "PENDING_SETTLEMENT",
      "SETTLED",
      "ABORTED",
    ])
  }

  private randomSettlementTransferState() {
    return this.harness.prng.randomElementFrom([
      'PS_TRANSFERS_RECORDED',
      'PS_TRANSFERS_RESERVED',
      'PS_TRANSFERS_COMMITTED',
      'SETTLED'
    ])
  }

  private randomDateTime(): string {
    const year = this.harness.prng.intInRange(2020, 2027)
    const month = String(this.harness.prng.intInRange(1, 12)).padStart(2, '0')
    const day = String(this.harness.prng.intInRange(1, 28)).padStart(2, '0')
    const hour = String(this.harness.prng.intInRange(0, 59)).padStart(2, '0')
    const min = String(this.harness.prng.intInRange(0, 59)).padStart(2, '0')
    const sec = String(this.harness.prng.intInRange(0, 59)).padStart(2, '0')

    return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`
  }
}
