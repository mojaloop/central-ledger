import { describe, it } from "node:test"
import path from 'path'
import LoggerMock from "../../testing/logger-mock"
import { logger as loggerGlobal } from "../../shared/logger"
// @ts-ignore  Override the globally exported logger. Note that we MUST do this before
// we import Harness, which imports the globals.
loggerGlobal = new LoggerMock()
import assert from "node:assert"
import Harness from '../../testing/harness'
import PRNG from "../../testing/prng"

import * as ApiHelpers from '../../testing/api-helpers'
import { envOrDefaultNumber, randomAvailablePort, sanitizeTestName } from "../../testing/util"
import { ReqRefDefaults, Server, ServerRoute } from "@hapi/hapi"
import { loggerFactory } from "@mojaloop/central-services-logger/src/contextLogger"
import fs from "node:fs"
import { ApplicationConfig } from "../../lib/config"
import HandlerV2 from "./handler-v2"
import Trace from "../../testing/fuzz/trace"
const logger = loggerFactory()

// We need to patch the date globally before starting the harness.
// This is quite annoying since it means we can't change easily change the seed in between runs.
const prng = new PRNG(envOrDefaultNumber('SEED', Math.floor(Math.random() * 1e8)))
Harness.injectPrngAndPatchDateGlobal(prng)
const harness = Harness.getInstance()
let server: Server

const filename = path.basename(__filename)
assert(filename)

describe('api/participants/handler', () => {
  it('is identical with/without LEDGER', async (context) => {
    const stepsMax = 3500
    const traceA = await run(stepsMax, { API_MODE_ADMIN: 'NONE' })
    const traceB = await run(stepsMax, { API_MODE_ADMIN: 'LEDGER'})
    
    const pathBase = `.fuzz_output/${filename}/${sanitizeTestName(context.name)}`
    fs.mkdirSync(pathBase, { recursive: true });
    const pathA = `${pathBase}/traceA.txt`
    const pathB = `${pathBase}/traceB.txt`

    fs.writeFileSync(pathA, traceA.toString())
    fs.writeFileSync(pathB, traceB.toString())

    console.log(`Fuzz trace written to ${pathBase}.`)
    console.log(`Compare the two files with:\n\tgit diff --no-index ${pathA} ${pathB}`)

    traceA.compare(traceB, {nameLeft: 'REFACTOR=false', nameRight: 'REFACTOR=true'})
  })

  it('is fully deterministic', async (context) => {
    const stepsMax = 250
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

    assert.ok(traceA === traceB, `Traces don't match!`)
  })

  const run = async (stepsMax: number, config: Partial<ApplicationConfig>): Promise<Trace> => {
    harness.clock.reset()
    harness.prng.reset()

    try {
      const options: FuzzOptions = { 
        stepsMax,
        injectDbFaults: false
      }
      await harness.up()
      await harness.setupGlobals()
      harness.configOverride(config)

      const buildRoutes = (await import('./routes-v2')).default
      const handler = new HandlerV2({
        config: harness.config,
        ledger: harness.ledger,
      })
      const routesParticipants = buildRoutes(handler)
      const routesSettlementModels = (await import('../settlementModels/routes'))
        .default as ServerRoute<ReqRefDefaults>[]
      const port = await randomAvailablePort()
      server = new Server({
        port
      })
      server.route(routesParticipants)
      server.route(routesSettlementModels)
      await server.start()

      harness.prng.reset()
      const fuzzer = new HandlerApiFuzzer(options, harness, server)
      await fuzzer.run()

      await server.stop()
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

  it('handler fuzz', async () => {
    try {
      const options: FuzzOptions = {
        stepsMax: envOrDefaultNumber('STEPS_MAX', 5000),
        injectDbFaults: false
      }

      await harness.up()
      await harness.setupGlobals()

      const buildRoutes = (await import('./routes-v2')).default
      const handler = new HandlerV2({
        config: harness.config,
        ledger: harness.ledger,
      })
      const routesParticipants = buildRoutes(handler)
      const routesSettlementModels = (await import('../settlementModels/routes'))
        .default as ServerRoute<ReqRefDefaults>[]
      const port = await randomAvailablePort()
      server = new Server({
        port
      })
      server.route(routesParticipants)
      server.route(routesSettlementModels)
      await server.start()

      const fuzzer = new HandlerApiFuzzer(options, harness, server)
      await fuzzer.run()
      logger.info(`trace:\n${fuzzer.trace.toString()}`)

      await server.stop()
    } catch (err: any) {
      logger.error(err.message)
      logger.error(err.stack)
      throw err
    } finally {
      await harness.teardownGlobals()
      await harness.down()
    }
  })
})

type ActionName =
  | 'getAll'
  | 'getByName'
  | 'create'
  | 'update'
  | 'addEndpoint'
  | 'getEndpoint'
  | 'addLimitAndInitialPosition'
  | 'getLimits'
  | 'getLimitsForAllParticipants'
  | 'adjustLimits'
  | 'createHubAccount'
  | 'getPositions'
  | 'getAccounts'
  | 'updateAccount'
  | 'recordFundsCreate'
  | 'recordFundsUpdate'
  | 'createSettlementModel'

interface FuzzOptions {
  /**
   * How many steps the fuzzer should take.
   */
  stepsMax: number,

  /**
   * If true, randomly injects db faults by overriding Knex.
   * Set to false when validating 2 implementations, otherwise the prng tends to drift!
   */
  injectDbFaults: boolean
}

class HandlerApiFuzzer {
  private step = 1
  private readonly stepsMax: number
  private _trace = new Trace()
  private dfspNames: Array<string> = []
  private dfspAccountsPosition: Record<string, Array<number>> = {}
  private dfspAccountsSettlement: Record<string, Array<number>> = {}
  private dfspEndpoints: Record<string, Array<string>> = {}
  private transferIds: Array<string> = []
  private registeredCurrencies: Array<string> = []
  private settlementModels: Array<any> = []

  private weights: Record<ActionName, number> = {
    getAll: 1,
    getByName: 1,
    create: 1,
    update: 1,
    addEndpoint: 1,
    getEndpoint: 1,
    addLimitAndInitialPosition: 1,
    getLimits: 1,
    getLimitsForAllParticipants: 1,
    adjustLimits: 1,
    createHubAccount: 10,
    getPositions: 1,
    getAccounts: 1,
    updateAccount: 1,
    recordFundsCreate: 1,
    recordFundsUpdate: 1,
    // The new API won't support this, but we still need to define it here!
    createSettlementModel: 0,
  }

  private _dbCalls = 0
  private _dbOriginal: any

  constructor(
    private options: FuzzOptions,
    private harness: Harness,
    private server: Server,
  ) {
    assert(options.stepsMax)

    this.stepsMax = options.stepsMax
    if (options.injectDbFaults) {
      this.injectDbFaults()
    }
  }

  public async run() {
    logger.warn(`HandlerApiFuzzer.run() running:`)
    logger.warn(`\tSEED      = ${this.harness.seed}`)
    logger.warn(`\tSTEPS_MAX = ${this.stepsMax} `)

    try {
      while (this.step <= this.stepsMax) {
        // if (this.step === 3037) {
        //   console.log('break at step!')
        // }
        await this.doStep()
        this.harness.clock.tick()

        this.step += 1
      }
    } catch (err: any) {
      logger.error(`HandlerApiFuzzer.run() died on step: ${this.step}.`)
      logger.error(`Error: ${err.message}\nStack: ${err.stack}`)
      logger.error(`HandlerApiFuzzer.run() rerun with SEED=${this.harness.seed}`)
      throw err
    } finally {
      this.resetDbFaults()
    }
  }

  get trace() {
    return this._trace
  }

  private async doStep() {
    return this.randomAction()()
  }

  /**
   * Override the global DB to sometimes fail.
   * 
   * This isn't always helpful since it increments the prng every time the db is called.
   * That means that for non identical implementations which call the db a different
   * number of times, they will advance the prng differently and cause the 2 prngs to
   * drif
   */
  private injectDbFaults() {
    const Db = require('../../lib/db')
    this._dbOriginal = Db.from.bind(Db)

    Db.from = (tableName: string) => {
      this._dbCalls += 1
      if (this.harness.prng.intExclusive(250) === 0) {
        throw new Error('Injected DB fault.')
      }
      return this._dbOriginal(tableName)
    }
  }

  private resetDbFaults() {
    if (!this._dbOriginal) {
      return
    }

    const Db = require('../../lib/db')
    Db.from = this._dbOriginal
  }

  private actions: Record<ActionName, () => Promise<void>> = {
    getAll: () => this.getAll(),
    getByName: () => this.getByName(),
    create: () => this.create(),
    update: () => this.update(),
    addEndpoint: () => this.addEndpoint(),
    getEndpoint: () => this.getEndpoint(),
    addLimitAndInitialPosition: () => this.addLimitAndInitialPosition(),
    getLimits: () => this.getLimits(),
    getLimitsForAllParticipants: () => this.getLimitsForAllParticipants(),
    adjustLimits: () => this.adjustLimits(),
    createHubAccount: () => this.createHubAccount(),
    getPositions: () => this.getPositions(),
    getAccounts: () => this.getAccounts(),
    updateAccount: () => this.updateAccount(),
    recordFundsCreate: () => this.recordFundsCreate(),
    recordFundsUpdate: () => this.recordFundsUpdate(),
    createSettlementModel: () => Promise.resolve(),
  }

  private randomAction(): () => Promise<void> {
    const table = PRNG.generateWeightedChoiceTable<ActionName>(this.weights)
    const action = this.harness.prng.randomElementFrom(table)
    return this.actions[action]
  }

  private async request(action: ActionName, method: string, path: string, payload?: any) {
    const res = await this.server.inject({
      method,
      url: path,
      payload,
      headers: { 'Content-Type': 'application/json' }
    })

    this._trace.push({
      step: this.step,
      action,
      path,
      payload,
      code: res.statusCode,
      body: res.result,
      prngCalls: this.harness.prng.callCount
    })

    if (action === 'getAccounts' && res.statusCode === 200) {
      assert(res)
      const name = path.match(/^\/participants\/(.*)\/accounts/)
      assert(name !== null && name[1], `Could not match dfsp name from path: '${path}'.`)
      const accounts = res.result as Array<{ id: number, ledgerAccountType: string }>
      // Store the dfsp=>[account] mapping to the list of ids.
      this.dfspAccountsPosition[name[1]] = [
        ...accounts
          .filter(account => account.ledgerAccountType === 'POSITION')
          .map(account => account.id)
      ]
      this.dfspAccountsSettlement[name[1]] = [
        ...accounts
          .filter(account => account.ledgerAccountType === 'SETTLEMENT')
          .map(account => account.id),
      ]
    }

    if (action === 'addEndpoint' && res.statusCode === 201) {
      const match = path.match(/^\/participants\/(.*)\/endpoints/)
      assert(match !== null)
      assert(match[1])
      const name = match[1]

      if (name && payload?.type) {
        if (!this.dfspEndpoints[name]) {
          this.dfspEndpoints[name] = []
        }
        this.dfspEndpoints[name].push(payload.type)
      }
    }

    return res
  }

  // API Methods under test.
  public async getAll() {
    const query = this.harness.prng.randomElementFrom([
      this.harness.prng.mutateString(`?isProxy=${this.harness.prng.headsOrTails()}`), ''
    ])
    await this.request('getAll', 'GET', '/participants' + query, {})
  }

  public async getByName() {
    const name = this.randomDfspName()
    await this.request('getByName', 'GET', `/participants/${name}`, {})
  }

  public async setupDefaultSettlementModel() {
    const payload = {
      // I would like to call it DEFERRED_MULTILATERAL_NET_DEFAULT, but the API limits the length to
      // 30 characters and doesn't allow underscores.
      name: `DeferredMultiNetDefault`,
      settlementGranularity: "NET",
      settlementInterchange: "MULTILATERAL",
      settlementDelay: "DEFERRED",
      // currency: 'USD',
      requireLiquidityCheck: true,
      ledgerAccountType: "POSITION",
      autoPositionReset: true,
      settlementAccountType: "SETTLEMENT",
    }
    const res = await this.request('createSettlementModel', 'POST', `/settlementModels`, payload)
    // console.log('setupDefaultSettlementModel', res)
    assert(res.statusCode === 201, 'Failed to create Default Settlement model.')
    this.settlementModels.push(payload)
  }

  public async create() {
    // Create the default settlement model if not created.
    if (this.settlementModels.length === 0) {
      await this.setupDefaultSettlementModel()
    }
    
    const payload = this.harness.prng.mutateObject({
      name: this.randomDfspName(),
      currency: this.randomCurrency(),
      isProxy: this.harness.prng.headsOrTails()
    })
    await this.request('create', 'POST', `/participants`, payload)
  }

  public async update() {
    const name = this.randomDfspName()
    const payload = this.harness.prng.mutateObject({
      isActive: this.harness.prng.headsOrTails()
    })
    await this.request('update', 'PUT', `/participants/${name}`, payload)
  }

  public async addEndpoint() {
    const name = this.randomDfspName()
    const payload = this.harness.prng.mutateObject({
      type: this.randomEndpointType(),
      value: `http://` + this.harness.prng.randomString()
    })
    await this.request('addEndpoint', 'POST', `/participants/${name}/endpoints`, payload)
  }

  public async getEndpoint() {
    const knownDfsps = Object.keys(this.dfspEndpoints).filter(d => this.dfspEndpoints[d].length > 0)

    if (knownDfsps.length > 0 && this.harness.prng.headsOrTails()) {
      const name = this.harness.prng.randomElementFrom(knownDfsps)
      const endpointType = this.harness.prng.randomElementFrom(this.dfspEndpoints[name])
      await this.request(
        'getEndpoint', 'GET', `/participants/${name}/endpoints?type=${endpointType}`, {}
      )
      return
    }

    const name = this.randomDfspName()
    const query = this.harness.prng.randomElementFrom([
      `?type=${this.randomEndpointType()}`,
      ''
    ])
    await this.request('getEndpoint', 'GET', `/participants/${name}/endpoints${query}`, {})
  }

  public async addLimitAndInitialPosition() {
    const name = this.randomDfspName()
    const currency = this.randomCurrency()

    const payload = {
      currency,
      limit: {
        type: this.harness.prng.randomElementWeighted([
          'NET_DEBIT_CAP', // Valid.
          this.harness.prng.randomString()
        ], [5, 1]),
        value: this.harness.prng.intInRange(0, 1000000),
        alarmPercentage: this.harness.prng.intExclusive(100),
      },
      initialPosition: this.harness.prng.randomElementFrom([
        this.harness.prng.intInRange(0, 1000000),
      ])
    }
    await this.request(
      'addLimitAndInitialPosition',
      'POST',
      `/participants/${name}/initialPositionAndLimits`,
      payload
    )
  }

  public async getLimits() {
    const name = this.randomDfspName()
    const url = `/participants/${name}/limits`
    const query = this.harness.prng.mutateString(
      `?currency=${this.randomCurrency()}&type=NET_DEBIT_CAP`
    )
    await this.request('getLimits', 'GET', url + query, {})
  }

  public async getLimitsForAllParticipants() {
    const url = `/participants/limits`
    const query = this.harness.prng.mutateString(
      `?currency=${this.randomCurrency()}&type=NET_DEBIT_CAP`
    )
    await this.request('getLimitsForAllParticipants', 'GET', url + query, {})
  }

  public async adjustLimits() {
    const name = this.randomDfspName()
    const url = `/participants/${name}/limits`
    const payload = this.harness.prng.mutateObject({
      currency: this.randomCurrency(),
      limit: {
        type: this.harness.prng.randomElementFrom([
          'NET_DEBIT_CAP', // Valid.
          this.harness.prng.randomString()
        ]),
        value: this.harness.prng.intInRange(0, 1000000),
        alarmPercentage: this.harness.prng.intInRange(-1, 101),
      },
    })
    await this.request('adjustLimits', 'PUT', url, payload)
  }

  public async createHubAccount() {
    // The odds of this all getting created properly are quite low, so let's flip a coin and just
    // set up the hub if true.
    if (this.harness.prng.headsOrTails() && this.registeredCurrencies.length < 2) {
      const currency = this.harness.prng.randomElementFrom(['USD', 'EUR', 'GBP'])
      try {
        await ApiHelpers.buildHub()
          .deps(this.harness)
          .currency(currency)
          .build()
          .create()
      } catch (err: any) {
        assert.equal(err.message, 'Injected DB fault.')
      }
      this.registeredCurrencies.push(currency)

      this.weights.createHubAccount = 1
      this.weights.create = 10
    }

    const name = this.harness.prng.randomElementFrom([
      'Hub',
      this.randomDfspName(),
      this.harness.prng.mutateString('Hub')
    ])
    const url = `/participants/${name}/accounts`
    const payload = this.harness.prng.mutateObject({
      currency: this.harness.prng.randomElementFrom(['USD', 'EUR', 'GBP']),
      type: this.harness.prng.randomElementFrom([
        'POSITION',
        'SETTLEMENT',
        'HUB_RECONCILIATION',
        'HUB_MULTILATERAL_SETTLEMENT',
        'HUB_FEE',
        'POSITION_REMITTANCE',
        'SETTLEMENT_REMITTANCE',
        this.harness.prng.randomString(),
      ])
    })
    await this.request('createHubAccount', 'POST', url, payload)
  }

  public async getPositions() {
    const name = this.randomDfspName()
    const url = `/participants/${name}/positions`
    const query = this.harness.prng.mutateString(`?currency=${this.randomCurrency()}`)
    await this.request('getPositions', 'GET', url + query, {})
  }

  public async getAccounts() {
    const name = this.randomDfspName()
    const url = `/participants/${name}/accounts`
    const query = this.harness.prng.randomElementFrom([
      '', `?currency${this.randomCurrency}`
    ])
    await this.request('getAccounts', 'GET', url + query, {})
  }

  public async updateAccount() {
    const name = this.randomDfspName()
    const account = this.randomDfspAccountPosition(name)
    const url = `/participants/${name}/accounts/${account}`
    const payload = {
      isActive: this.harness.prng.headsOrTails(),
    }
    await this.request('updateAccount', 'PUT', url, payload)
  }

  public async recordFundsCreate() {
    const name = this.randomDfspName()
    const account = this.randomDfspAccountSettlement(name)
    const url = `/participants/${name}/accounts/${account}`
    const payload = this.harness.prng.mutateObject({
      transferId: this.randomTransferId(),
      externalReference: this.harness.prng.randomString(),
      action: this.harness.prng.randomElementFrom([
        'recordFundsIn',
        'recordFundsOutPrepareReserve',
        this.harness.prng.randomString(),
      ]),
      reason: this.harness.prng.randomString(),
      amount: {
        amount: this.harness.prng.intInRange(-1, 10000) / 100,
        currency: this.randomCurrency()
      }
    })
    await this.request('recordFundsCreate', 'POST', url, payload)
  }

  public async recordFundsUpdate() {
    const name = this.randomDfspName()
    const account = this.randomDfspAccountSettlement(name)
    const transferId = this.randomTransferId()
    const url = `/participants/${name}/accounts/${account}/${transferId}`
    const payload = this.harness.prng.mutateObject({
      action: this.harness.prng.randomElementFrom([
        'recordFundsOutCommit',
        'recordFundsOutAbort',
        this.harness.prng.randomString(),
      ]),
      reason: this.harness.prng.randomString(),
    })
    await this.request('recordFundsUpdate', 'PUT', url, payload)
  }

  private randomDfspName(): string {
    if (this.dfspNames.length > 0 && this.harness.prng.intExclusive(100) > 20) {
      // Reuse
      return this.harness.prng.randomElementFrom(this.dfspNames)
    }

    const name = `dfsp_${this.harness.prng.randomString(this.harness.prng.intInRange(1, 5))}`
    return name
  }

  private randomDfspAccountPosition(dfsp: string): number {
    if (this.dfspAccountsPosition[dfsp] &&
      this.dfspAccountsPosition[dfsp].length > 0 &&
      this.harness.prng.headsOrTails()
    ) {
      return this.harness.prng.randomElementFrom(this.dfspAccountsPosition[dfsp])
    }

    return this.harness.prng.intInRange(-1, 10)
  }

  private randomDfspAccountSettlement(dfsp: string): number {
    if (this.dfspAccountsSettlement[dfsp] &&
      this.dfspAccountsSettlement[dfsp].length > 0 &&
      this.harness.prng.headsOrTails()
    ) {
      return this.harness.prng.randomElementFrom(this.dfspAccountsSettlement[dfsp])
    }

    return this.harness.prng.intInRange(-1, 10)
  }

  private randomTransferId(): string {
    if (this.transferIds.length > 0 && this.harness.prng.headsOrTails()) {
      // Reuse
      return this.harness.prng.randomElementFrom(this.transferIds)
    }

    const id = this.harness.prng.mutateString(this.harness.prng.uuidv4())
    this.transferIds.push(id)

    return id
  }

  private randomCurrency(): string {
    const currency = this.harness.prng.randomElementFrom(['USD', 'BGP', 'EUR', 'GBP'])
    return this.harness.prng.randomElementWeighted(
      [currency, this.harness.prng.mutateString(currency)], [8, 2]
    )
  }

  private randomEndpointType(): string {
    const endpointTypesValid = [
      'FSPIOP_CALLBACK_URL_TRANSFER_POST',
      'FSPIOP_CALLBACK_URL_TRANSFER_PUT',
      'FSPIOP_CALLBACK_URL_TRANSFER_ERROR',
      'FSPIOP_CALLBACK_URL_FX_QUOTES',
      'FSPIOP_CALLBACK_URL_FX_TRANSFER_POST',
      'FSPIOP_CALLBACK_URL_FX_TRANSFER_PUT',
      'FSPIOP_CALLBACK_URL_FX_TRANSFER_ERROR',
      'FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST',
      'FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT',
      'FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR',
      'FSPIOP_CALLBACK_URL_PARTICIPANT_PUT',
      'FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT',
      'FSPIOP_CALLBACK_URL_PARTICIPANT_PUT_ERROR',
      'FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT_ERROR',
      'FSPIOP_CALLBACK_URL_PARTICIPANT_DELETE',
      'FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_DELETE',
      'FSPIOP_CALLBACK_URL_PARTICIPANT_BATCH_PUT',
      'FSPIOP_CALLBACK_URL_PARTICIPANT_BATCH_PUT_ERROR',
      'FSPIOP_CALLBACK_URL_PARTIES_GET',
      'FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_GET',
      'FSPIOP_CALLBACK_URL_PARTIES_PUT',
      'FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_PUT',
      'FSPIOP_CALLBACK_URL_PARTIES_PUT_ERROR',
      'FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_PUT_ERROR',
      'FSPIOP_CALLBACK_URL_QUOTES',
      'FSPIOP_CALLBACK_URL_BULK_QUOTES',
      'FSPIOP_CALLBACK_URL_AUTHORIZATIONS',
      'FSPIOP_CALLBACK_URL_TRX_REQ_SERVICE',
      'ALARM_NOTIFICATION_URL',
      'ALARM_NOTIFICATION_TOPIC',
      'NET_DEBIT_CAP_THRESHOLD_BREACH_EMAIL',
      'NET_DEBIT_CAP_ADJUSTMENT_EMAIL',
      'SETTLEMENT_TRANSFER_POSITION_CHANGE_EMAIL',
    ]
    let endpoint = this.harness.prng.randomElementFrom(endpointTypesValid)
    if (this.harness.prng.headsOrTails()) {
      return endpoint
    }

    return this.harness.prng.mutateString(endpoint)
  }
}