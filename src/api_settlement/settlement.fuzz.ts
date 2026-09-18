import { describe, it } from "node:test"
import path from 'path'
import LoggerMock from "../testing/logger-mock"
import { logger as loggerGlobal } from "../shared/logger"
// @ts-ignore  Override the globally exported logger. Note that we MUST do this before
// we import Harness, which imports the globals.
loggerGlobal = new LoggerMock()
import Harness from "../testing/harness"
import { loggerFactory } from "@mojaloop/central-services-logger/src/contextLogger"
import * as ApiHelpers from '../testing/api-helpers'
import { envOrDefaultNumber, randomAvailablePort, sanitizeTestName } from "../testing/util"
import { ReqRefDefaults, Server, ServerRoute } from "@hapi/hapi"
import Trace from "../testing/fuzz/trace"
import assert from "node:assert"
import PRNG from "../testing/prng"
import { ApplicationConfig } from "../lib/config"
import { Settlement } from "../domain/ledger/types"
const logger = loggerFactory()

// We need to patch the date globally before starting the harness.
// This is quite annoying since it means we can't change easily change the seed in between runs.
const prng = new PRNG(envOrDefaultNumber('SEED', Math.floor(Math.random() * 1e8)))
Harness.injectPrngAndPatchDateGlobal(prng)
const harness = Harness.getInstance()
let server: Server

const filename = path.basename(__filename)
assert(filename)

describe('Settlement API Fuzz', () => {
  it('runs the fuzzer', async () => {
    const stepsMax = envOrDefaultNumber('STEPS_MAX', 100)
    await run(stepsMax, {})
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

    const port = await randomAvailablePort()
    const routes = await import('./routes')
    const Setup = await import('../shared/setup')
    server = await Setup.createServer(port, routes)

    harness.prng.reset()
    const fuzzer = new SettlementApiFuzzer(options, harness, server)
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

type ActionName =
  // Settlement Methods.
  | 'getSettlementsByParams'              // GET /settlements
  | 'createSettlement'                    // POST /settlements
  | 'getSettlementById'                   // GET /settlements/{id}
  | 'updateSettlement'                    // PUT /settlements/{id} (with participants payload)
  | 'abortSettlement'                     // PUT /settlements/{id} (with state=ABORTED payload)
  | 'getSettlementByParticipant'          // GET /settlements/{sid}/participants/{pid}
  | 'updateSettlementByParticipant'       // PUT /settlements/{sid}/participants/{pid}
  | 'getSettlementByParticipantAccount'   // GET /settlements/{sid}/participants/{pid}/accounts/{aid}
  | 'updateSettlementByParticipantAccount'// PUT /settlements/{sid}/participants/{pid}/accounts/{aid}
  | 'getSettlementWindowsByParams'        // GET /settlementWindows
  | 'getSettlementWindowById'             // GET /settlementWindows/{id}
  | 'closeSettlementWindow'               // POST /settlementWindows/{id}
  // Setup Methods.
  | 'makePayment'
  | 'createHubAccount'
  | 'createSettlementModel'
  | 'createDfsp'

interface FuzzOptions {
  /**
   * How many steps the fuzzer should take.
   */
  stepsMax: number,
}

class SettlementApiFuzzer {
  private step = 1
  private readonly stepsMax: number
  private _trace = new Trace()
  private registeredCurrencies: Array<string> = []
  private registeredDfsps: Array<string> = []
  // Keep track of the created settlements.
  private settlements: Array<Settlement> = []

  private weights: Record<ActionName, number> = {
    getSettlementsByParams: 1,
    createSettlement: 2,
    getSettlementById: 1,
    updateSettlement: 2,
    abortSettlement: 1,
    getSettlementByParticipant: 1,
    updateSettlementByParticipant: 2,
    getSettlementByParticipantAccount: 1,
    updateSettlementByParticipantAccount: 1,
    getSettlementWindowsByParams: 1,
    getSettlementWindowById: 1,
    closeSettlementWindow: 3,
    makePayment: 5,
    createHubAccount: 10,
    createSettlementModel: 0,
    createDfsp: 0,
  }

  constructor(
    private options: FuzzOptions,
    private harness: Harness,
    private server: Server,
  ) {
    assert(options.stepsMax)
    this.stepsMax = options.stepsMax
  }

  public async run() {
    logger.warn(`SettlementApiFuzzer.run() running:`)
    logger.warn(`\tSEED      = ${this.harness.seed}`)
    logger.warn(`\tSTEPS_MAX = ${this.stepsMax} `)

    try {
      while (this.step <= this.stepsMax) {
        await this.doStep()
        this.harness.clock.tick()

        this.step += 1
      }
    } catch (err: any) {
      logger.error(`SettlementApiFuzzer.run() died on step: ${this.step}.`)
      logger.error(`Error: ${err.message}\nStack: ${err.stack}`)
      logger.error(`SettlementApiFuzzer.run() rerun with SEED=${this.harness.seed}`)
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
    getSettlementsByParams: () => this.getSettlementsByParams(),
    createSettlement: () => this.createSettlement(),
    getSettlementById: () => this.getSettlementById(),
    updateSettlement: () => this.updateSettlement(),
    abortSettlement: () => this.abortSettlement(),
    getSettlementByParticipant: () => this.getSettlementByParticipant(),
    updateSettlementByParticipant: () => this.updateSettlementByParticipant(),
    getSettlementByParticipantAccount: () => this.getSettlementByParticipantAccount(),
    updateSettlementByParticipantAccount: () => this.updateSettlementByParticipantAccount(),
    getSettlementWindowsByParams: () => this.getSettlementWindowsByParams(),
    getSettlementWindowById: () => this.getSettlementWindowById(),
    closeSettlementWindow: () => this.closeSettlementWindow(),
    makePayment: () => this.makePayment(),
    createHubAccount: () => this.createHubAccount(),
    createSettlementModel: () => this.createSettlementModel(),
    createDfsp: () => this.createDfsp(),
  }

  private randomAction(): () => Promise<void> {
    const table = PRNG.generateWeightedChoiceTable<ActionName>(this.weights)
    const action = this.harness.prng.randomElementFrom(table)
    return this.actions[action]
  }

  private async request(action: ActionName, method: string, path: string, payload?: any) {
    const res = await this.server.inject({
      method,
      url: '/v2' + path,
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

    return res
  }

  private async getSettlementsByParams(): Promise<void> {
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
    const paramsCount = this.harness.prng.intInRange(0, keys.length)
    const keysSelected = this.harness.prng.randomSampleFrom(keys, paramsCount)
    const params = keysSelected.map(key => `${key}=${generators[key]()}`)
    let query = ''
    if (params.length > 0) {
      query += `?` + params.join('&')
    }

    await this.request('getSettlementsByParams', 'GET', '/settlements' + query, {})
  }

  private async createSettlement(): Promise<void> {
    const windows = (await ApiHelpers.getSettlementWindows(harness))
      .filter(window => window.state === 'CLOSED')

    if (windows.length === 0 && this.harness.prng.coin()) {
      // Don't bother trying if we don't have a closed window, so just close a window.
      await this.closeSettlementWindow()
      return
    }

    let windowIds: Array<{ id: number }> = []
    if (windows.length > 0) {
      windowIds = this.harness.prng.randomSampleFrom(
        windows.map(window => ({ id: window.settlementWindowId })),
        this.harness.prng.intExclusive(windows.length + 1)
      )
    }

    const payload = {
      settlementModel: `DEFERRED_MULTILATERAL_NET_${this.randomCurrency()}`,
      reason: this.harness.prng.randomString(),
      settlementWindows: windowIds,
    }
    const res = await this.request('createSettlement', 'POST', '/settlements', payload)

    if (res.statusCode === 200) {
      this.settlements.push(res.result as Settlement)
    }
  }

  private async getSettlementById(): Promise<void> {
    let id = this.harness.prng.intExclusive(100)
    if (this.settlements.length > 0 && this.harness.prng.coin()) {
      id = this.harness.prng.randomElementFrom(this.settlements).id
    }

    const res = await this.request('getSettlementById', 'GET', `/settlements/${id}`, {})
  }

  private async updateSettlement(): Promise<void> {
    if (this.settlements.length === 0) {
      // Most likely skip if we don't have any settlements.
      return
    }

    const settlement = this.harness.prng.randomElementFrom(this.settlements)
    const countParticipants = settlement.participants.length
    // Simple mode - update all participants in one go.
    const accountStatesParticipant = Array(countParticipants)
      .fill(this.randomSettlementTransferState())

    assert(settlement.participants.length === accountStatesParticipant.length)
    const participants = settlement.participants.map((participant, idx) => {
      assert(participant.accounts.length === 1, 'Expected only 1 account for participant.')
      return {
        id: participant.id,
        accounts: [
          {
            id: participant.accounts[0].id,
            state: accountStatesParticipant[idx],
            reason: this.harness.prng.randomString(),
            externalReference: this.harness.prng.randomString(),
          }
        ]
      }
    })

    const payload = {
      participants
    }
    const id = this.harness.prng.randomElementWeighted(
      [settlement.id, this.harness.prng.intExclusive(1500)], 
      [99, 1]
    )
    await this.request(
      'updateSettlement', 
      'PUT', 
      `/settlements/${id}`, 
      payload
    )
  }

  // I'm pretty sure this was never implemented/tested in the existing central-settlements codebase.
  private async abortSettlement(): Promise<void> {
    if (this.settlements.length === 0 && this.harness.prng.intExclusive(100) < 98) {
      // Most likely skip if we don't have any settlements.
      return
    }

    let settlementId = this.harness.prng.intExclusive(1000)
    if (this.settlements.length > 0) {
      const settlement = this.harness.prng.randomElementFrom(this.settlements)
      settlementId = settlement.id
    }
    const payload = {
      reason: this.harness.prng.randomString(),
      state: this.harness.prng.randomElementWeighted([
        'ABORTED', this.randomSettlementState()
      ], [50, 1])
    }
    await this.request(
      'abortSettlement',
      'PUT',
      `/settlements/${settlementId}`,
      payload
    )
  }

  private async getSettlementByParticipant(): Promise<void> {
    if (this.settlements.length === 0 && this.harness.prng.intExclusive(100) < 98) {
      // Most likely skip if we don't have any settlements.
      return
    }


    let settlementId = this.harness.prng.intExclusive(1000)
    let participantId = this.harness.prng.intExclusive(1000)
    if (this.settlements.length > 0 && this.harness.prng.intExclusive(100) < 98) {
      const settlement = this.harness.prng.randomElementFrom(this.settlements)
      settlementId = settlement.id

      const participant = this.harness.prng.randomElementFrom(settlement.participants)
      participantId = participant.id
    }

    await this.request(
      'getSettlementByParticipant',
      'GET',
      `/settlements/${settlementId}/participants/${participantId}`,
      {}
    )
  }

  private async updateSettlementByParticipant(): Promise<void> {
    if (this.settlements.length === 0 && this.harness.prng.intExclusive(100) < 98) {
      // Most likely skip if we don't have any settlements.
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

    const payload = {
      accounts: [
        {
          id: accountId,
          state: this.randomSettlementTransferState(),
          reason: this.harness.prng.randomString(),
          externalReference: this.harness.prng.randomString(),
        }
      ]
    }

    await this.request(
      'updateSettlementByParticipant',
      'PUT',
      `/settlements/${settlementId}/participants/${participantId}`,
      payload
    )    
  }

  private async getSettlementByParticipantAccount(): Promise<void> {
    if (this.settlements.length === 0 && this.harness.prng.intExclusive(100) < 98) {
      // Most likely skip if we don't have any settlements.
      return
    }

    let settlementId
    let participantId
    let accountId
    if (this.settlements.length > 0 && this.harness.prng.intExclusive(100) < 95) {
      const settlement = this.harness.prng.randomElementFrom(this.settlements)
      settlementId = settlement.id
      const participant = this.harness.prng.randomElementFrom(settlement.participants)
      participantId = participant.id
      assert(participant.accounts.length > 0, 'Expected participant to have at least one account.')
      accountId = this.harness.prng.randomElementFrom(participant.accounts).id
    } else {
      settlementId = this.harness.prng.intExclusive(1000)
      participantId = this.harness.prng.intExclusive(1000)
      accountId = this.harness.prng.intExclusive(1000)
    }

    await this.request(
      'getSettlementByParticipantAccount',
      'GET',
      `/settlements/${settlementId}/participants/${participantId}/accounts/${accountId}`,
      {}
    )
  }

  private async updateSettlementByParticipantAccount(): Promise<void> {
    if (this.settlements.length === 0 && this.harness.prng.intExclusive(100) < 98) {
      // Most likely skip if we don't have any settlements.
      return
    }

    let settlementId
    let participantId
    let accountId
    if (this.settlements.length > 0 && this.harness.prng.intExclusive(100) < 95) {
      const settlement = this.harness.prng.randomElementFrom(this.settlements)
      settlementId = settlement.id
      const participant = this.harness.prng.randomElementFrom(settlement.participants)
      participantId = participant.id
      assert(participant.accounts.length > 0, 'Expected participant to have at least one account.')
      accountId = this.harness.prng.randomElementFrom(participant.accounts).id
    } else {
      settlementId = this.harness.prng.intExclusive(1000)
      participantId = this.harness.prng.intExclusive(1000)
      accountId = this.harness.prng.intExclusive(1000)
    }

    let payload = {
      state: this.randomSettlementTransferState(),
      reason: this.harness.prng.randomString(),
      externalReference: this.harness.prng.randomString(),
    }
    if (this.harness.prng.intExclusive(100) < 95) {
      payload = this.harness.prng.mutateObject(payload)
    }

    const res = await this.request(
      'updateSettlementByParticipantAccount',
      'PUT',
      `/settlements/${settlementId}/participants/${participantId}/accounts/${accountId}`,
      payload
    )
  }

  private async getSettlementWindowsByParams(): Promise<void> {
    const generators: Record<string, () => string> = {
      // TODO: enrich these with actual ids from the database.
      participantId: () => this.harness.prng.intExclusive(100).toString(),
      state: () => this.randomSettlementWindowState(),
      fromDateTime: () => this.randomDateTime(),
      toDateTime: () => this.randomDateTime(),
      currency: () => this.randomCurrency(),
    }

    const keys = Object.keys(generators)
    const paramsCount = this.harness.prng.randomElementWeighted([0, 1, 2, 3, 4], [5, 15, 3, 2, 1])
    const keysSelected = this.harness.prng.randomSampleFrom(keys, paramsCount)
    const params = keysSelected.map(key => `${key}=${generators[key]()}`)
    let query = ''
    if (params.length > 0) {
      query += `?` + params.join('&')
    }
    await this.request('getSettlementWindowsByParams', 'GET', `/settlementWindows${query}`, {})
  }

  private async getSettlementWindowById(): Promise<void> {
    let windowId
    const windowIds = (await ApiHelpers.getSettlementWindows(harness))
      .map(window => window.settlementWindowId)
    if (windowIds.length > 0 && this.harness.prng.headsOrTails()) {
      windowId = this.harness.prng.randomElementFrom(windowIds)
    }
    windowId = this.harness.prng.randomElementFrom([
      ...windowIds,
      this.harness.prng.intExclusive(100)
    ])

    await this.request('getSettlementWindowById', 'GET', `/settlementWindows/${windowId}`, {})
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
    const payload = this.harness.prng.mutateObject({
      state: 'CLOSED',
      reason: this.harness.prng.randomString()
    })
    await this.request('closeSettlementWindow', 'POST', `/settlementWindows/${windowId}`, payload)
  }

  private async makePayment(): Promise<void> {
    if (this.registeredDfsps.length < 2) {
      // Skipping makePayment as we don't have enough dfsps registered.
      return
    }

    const [payer, payee] = this.harness.prng.randomSampleFrom(this.registeredDfsps, 2)
    const payment = ApiHelpers.buildPayment()
      .deps(this.harness)
      .amount(this.randomAmount(), this.randomCurrency())
      .parties(payer, payee)
      .expiry(this.harness.prng.intExclusive(500))
      .transferId(this.harness.prng.uuidv4())
      .build()
    let code = 200
    try {
      await harness.messageBus.prepare(null, [payment.buildMessagePrepare()])
      const status = await payment.getStatus()
      if (status === 'RECEIVED_PREPARE') {
        await harness.messageBus.fulfil(null, [payment.buildMessageFulfil('COMMITTED')])
      }
    } catch (err: any) {
      code = 400
      // logger.warn(`makePayment() failed with error: ${err.message}`)
    } finally {
      this.trace.push({
        step: this.step,
        action: "makePayment",
        path: "N/A",
        payload: payment.getOptions(),
        code,
        body: {},
        prngCalls: this.harness.prng.callCount
      })
    }
  }

  private randomAmount(): string {
    const left = String(this.harness.prng.intInRange(0, 9999)).padStart(2, '0')
    const right = String(this.harness.prng.intInRange(0, 99)).padStart(2, '0')
    return `${left}.${right}`
  }

  private async createHubAccount(): Promise<void> {
    const currency = this.randomCurrency()
    try {
      await ApiHelpers.buildHub()
        .deps(this.harness)
        .currency(currency)
        .build()
        .create()
      if (this.registeredCurrencies.indexOf(currency) === -1) {
        this.registeredCurrencies.push(currency)
      }

      // Adjust the weights
      this.weights.createHubAccount = 1
      this.weights.createDfsp = 3

    } catch (err: any) {
      logger.warn(`createHubAccount() failed with error: ${err.message}`)
    } finally {
      this.trace.push({
        step: this.step,
        action: "createHubAccount",
        path: "N/A",
        payload: "",
        code: -1,
        body: { currency },
        prngCalls: this.harness.prng.callCount
      })
    }
  }

  private async createSettlementModel(): Promise<void> {
    throw new Error('Not implemented')
  }

  private async createDfsp(): Promise<void> {
    const name = this.randomDfspName()
    const currency = this.randomCurrency()
    let code = 200
    try {
      await ApiHelpers.buildDfsp()
        .deps(this.harness)
        .name(name)
        .currency(currency)
        .proxy(this.harness.prng.headsOrTails())
        .build()
        .create()
      if (!this.registeredDfsps.find(dfsp => dfsp === name)) {
        this.registeredDfsps.push(name)
      }

      // We have enough DFSPs!
      if (this.registeredDfsps.length === 25) {
        this.weights.createDfsp = 0
      }
    } catch (err) {
      // logger.warn(`createDfsp() failed with name: ${name}, currency: ${currency}.`)
      code = 400
    } finally {
      this.trace.push({
        step: this.step,
        action: "createDfsp",
        path: "N/A",
        payload: "",
        code,
        body: { name, currency },
        prngCalls: this.harness.prng.callCount
      })
    }
  }

  private randomDfspName(): string {
    if (this.registeredDfsps.length > 0 && this.harness.prng.intExclusive(100) > 20) {
      // Reuse.
      return this.harness.prng.randomElementFrom(this.registeredDfsps)
    }

    const name = `dfsp_${this.harness.prng.randomString(this.harness.prng.intInRange(1, 5))}`
    return name
  }

  private randomCurrency(): string {
    // Quite likely to get a valid, registered currency.
    if (this.registeredCurrencies.length > 0 && this.harness.prng.headsOrTails()) {
      return this.harness.prng.randomElementFrom(this.registeredCurrencies)
    }

    const currency = this.harness.prng.randomElementFrom(['USD', 'AUD', 'EUR', 'GBP'])
    return this.harness.prng.randomElementWeighted(
      [currency, this.harness.prng.mutateString(currency)], [8, 2]
    )
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

  private randomSettlementTransferState(): string {
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
