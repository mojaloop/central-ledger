import { Enum, LedgerAccountTypeEnum } from '@mojaloop/central-services-shared'
import Harness from './harness'

import ParticipantService from '../domain/participant/index'
import SettlementModelService from '../domain/settlement'

import assert from "node:assert"

import Logger from "@mojaloop/central-services-logger"
import { Snapshot } from './snapshot'
import { sleepSeconds } from './util'

const { ilpFactory, ILP_VERSIONS } = require('@mojaloop/sdk-standard-components').Ilp
const ilpService = ilpFactory(ILP_VERSIONS.v1, { secret: 'password', logger: Logger })

export interface CreateSettlementModelPayload {
  name: string
  settlementGranularity: string
  settlementInterchange: string
  settlementDelay: string
  currency: string
  requireLiquidityCheck: boolean
  ledgerAccountType: string
  settlementAccountType: string
  autoPositionReset: boolean
}

export interface CreateHubPayload {
  currencies: Array<string>
  settlementModels: Array<CreateSettlementModelPayload>
}

/**
 * Creates hub accounts and settlement models.
 */
export const createHub = async (harness: Harness, payload: CreateHubPayload): Promise<void> => {
  assert.equal(payload.currencies.length, payload.settlementModels.length)
  for (const currency of payload.currencies) {
    await ParticipantService.createHubAccount(
      harness.config.HUB_ID, currency, Enum.Accounts.LedgerAccountType.HUB_RECONCILIATION
    )
    await ParticipantService.createHubAccount(
      harness.config.HUB_ID, currency, Enum.Accounts.LedgerAccountType.HUB_MULTILATERAL_SETTLEMENT
    )
  }

  for (const settlementModel of payload.settlementModels) {
    await SettlementModelService.createSettlementModel(settlementModel)
  }
}

export type CreateDfspPayload = {
  name: string,
  currencies: Array<string>,
  initialPostionsAndLimits: Array<{
    value: number,
    initialPosition: number
  }>,
  deposits: Array<number>
  isProxy: boolean
}

/**
 * Creates a DFSP.
 */
export const createDfsp = async (harness: Harness, payload: CreateDfspPayload): Promise<void> => {
  const accountTypes: Array<LedgerAccountTypeEnum> = [
    Enum.Accounts.LedgerAccountType.POSITION,
    Enum.Accounts.LedgerAccountType.SETTLEMENT
  ]
  const { name, currencies, isProxy, initialPostionsAndLimits, deposits } = payload;
  assert.equal(currencies.length, initialPostionsAndLimits.length)
  assert.equal(currencies.length, deposits.length)

  const resultGetByName = await ParticipantService.getByName(name)
  assert.equal(resultGetByName, undefined, `dfsp with name: ${name} already exists.`)

  const participantId = await ParticipantService.create({
    name, isProxy,
  })
  for (const currency of currencies) {
    for (const accountType of accountTypes) {
      await ParticipantService.createParticipantCurrency(
        participantId,
        currency,
        accountType,
        true
      )
    }
  }

  for (const [idx, limit] of initialPostionsAndLimits.entries()) {
    const currency = currencies[idx]
    const payload = {
      currency,
      limit: {
        type: 'NET_DEBIT_CAP',
        value: limit.value
      },
      initialPosition: limit.initialPosition
    }
    const mark = harness.redpandaMark()
    let result = await ParticipantService.addLimitAndInitialPosition(name, payload)
    assert.equal(result, true)
    await harness.redpandaDrain(mark, 1)

    result = await ParticipantService.getPositions(name, { currency })
    Snapshot.from(`{
      "currency": "${currency}",
      "value": "${limit.initialPosition}.0000",
      "changedDate": ":ignore"
    }`).checkUnwrap(result)
  }

  for await (const [idx, currency] of currencies.entries()) {
    const deposit = deposits[idx]
    const payload = {
      action: Enum.Events.Event.Action.RECORD_FUNDS_IN,
      reason: 'deposit',
      externalReference: `deposit-${name}`,
      amount: {
        amount: deposit.toString(),
        currency,
      }
    };
    let accounts = await ParticipantService.getAccounts(name, { currency })
    let settlementAccount = await ParticipantService.getAccountByNameAndCurrency(
      name, currency, Enum.Accounts.LedgerAccountType.SETTLEMENT
    );
    assert(settlementAccount, 'Settlement account not found');

    const mark = harness.redpandaMark()
    await ParticipantService.recordFundsInOut(
      payload,
      { name, id: settlementAccount.participantCurrencyId, transferId: `${name}_${currency}_01` },
      harness.enums
    )
    await harness.redpandaDrain(mark, 1)

    // Annoyingly we still have a position update race condition here.
    await sleepSeconds(2)
    accounts = await ParticipantService.getAccounts(name, { currency })
    const settlementAccountResponse = accounts
      .filter((account: any) => account.ledgerAccountType === 'SETTLEMENT')[0]
    assert(settlementAccountResponse)
    Snapshot.from(`{
      "id": :int,
      "ledgerAccountType": "SETTLEMENT",
      "currency": "${currency}",
      "isActive": 1,
      "value": "-${deposit}.0000",
      "reservedValue": "0.0000",
      "changedDate": :ignore
    }`).checkUnwrap(settlementAccountResponse)
  }
}

/**
 * Helper to get dfsp positions.
 */
export const getPositions = async (payer: string, payee: string, currency: string = 'USD') => {
  return Promise.all([getPositionAccount(payer, currency), getPositionAccount(payee, currency)])
}

/**
 * Helper to get Position account.
 */
export const getPositionAccount = async (name: string, currency: string) => {
  const account = (await ParticipantService.getAccounts(name, { currency }))
    .find(account => account.ledgerAccountType === 'POSITION')

  assert(account, `No position account found for name: ${name} + currency: ${currency}.`)
  return account;
}

/**
 * Helper to build both valid and invalid Mojaloop Payments. 
 * @example
 * // Create payment of $100.00 USD from dfsp_a to dfsp_b with id 1000001.
 * const payment = ApiHelpers.buildPayment()
 *   .deps(harness, TransferHandler)
 *   .parties('dfsp_a', 'dfsp_b')
 *   .transferId('1000001')
 *   .build()
 *
 * // Prepare the the payment.
 * await payment.prepare()
 *
 * // Fulfil the payment.
 * await payment.fulfil()
 * 
 */
export function buildPayment(): PaymentBuilder {
  return new PaymentBuilder()
}

/**
 * Helper to build Forex Payments. (POST /fxTransfer, PUT /fxTransfer).
 * 
 * @example
 * const forex = ApiHelpers.buildForex()
 *    .deps(harness, TransferHandler)
 *    .commitRequestId('2000002')
 *    .determiningTransferId('3000002')
 *    .parties('external_dfsp_a', 'external_dfsp_b')
 *    .amountSource('100.00', 'BWP')
 *    .amountTarget('1.00', 'USD')
 *    .build()
 *
 * // Prepare the forex.
 * await forex.prepare()
 */
export function buildForex(): ForexBuilder {
  return new ForexBuilder()
}

export interface PaymentOptions {
  harness: Harness,
  transferHandler: {
    prepare: (error: any, message: any) => Promise<void>
    fulfil: (error: any, message: any) => Promise<void>
  }
  payerFsp: string,
  payeeFsp: string,
  transferId: string,
  amountComplex: {
    amount: string,
    currency: string,
  }
  date: Date,
  expirySeconds: number,
  fx: boolean
}

export class Payment {
  private options: PaymentOptions;

  public constructor(options: PaymentOptions) {
    this.options = options
  }

  public async prepare(): Promise<this> {
    const mark = this.options.harness.redpandaMark()
    this.options.transferHandler.prepare(null, this.buildMessagePrepare())
    await this.options.harness.redpandaDrain(mark, 2)

    return this
  }

  /**
   * Build the prepare message to be passed to the kafka prepare handler.
   */
  public buildMessagePrepare() {
    const params: PostTransferBuilderParams = {
      payerFsp: this.options.payerFsp,
      payeeFsp: this.options.payeeFsp,
      transferId: this.options.transferId,
      amountComplex: {
        amount: this.options.amountComplex.amount,
        currency: this.options.amountComplex.currency,
      },
      date: this.options.date,
      expirySeconds: this.options.expirySeconds
    }
    const postTransfer = buildMojaloopPostTransfer(params)
    const messageKafka = buildMessagePrepare(this.options.harness, postTransfer)

    return messageKafka
  }

  /**
   * Build the fulfil message to be passed to the kafka fulfil handler.
   */
  public buildMessageFulfil(state: 'COMMITTED' | 'RESERVED') {
    const params: PutTransferBuilderParams = {
      payerFsp: this.options.payerFsp,
      payeeFsp: this.options.payeeFsp,
      transferId: this.options.transferId,
      amountComplex: {
        amount: this.options.amountComplex.amount,
        currency: this.options.amountComplex.currency,
      },
      date: this.options.date,
      expirySeconds: this.options.expirySeconds,
      transferState: state
    }
    const putTransfer = buildMojaloopPutTransfer(params)
    const messageKafka = buildMessageFulfil(
      this.options.harness, putTransfer, this.options.transferId
    )

    return messageKafka
  }

  public buildMessageAbort() {
    const putTransfer = buildMojaloopAbortTransfer({
      payerFsp: this.options.payerFsp,
      payeeFsp: this.options.payeeFsp,
      date: this.options.date,
    })
    const messageKafka = buildMessageAbort(
      this.options.harness, putTransfer, this.options.transferId
    )

    return messageKafka
  }

  public async fulfil(state: 'COMMITTED' | 'RESERVED' = 'COMMITTED'): Promise<this> {
    const mark = this.options.harness.redpandaMark()
    await this.options.transferHandler.fulfil(null, this.buildMessageFulfil(state))
    if (this.options.fx) {
      // If this is a properly build fx transfer, we want to consume 4 messages.
      await this.options.harness.redpandaDrain(mark, 4)
      return this
    }

    await this.options.harness.redpandaDrain(mark, 2)

    return this
  }

  public async prepareAndFulfil(): Promise<this> {
    await this.prepare()
    await this.fulfil()

    return this
  }

  public async abort(): Promise<this> {
    const mark = this.options.harness.redpandaMark()
    await this.options.transferHandler.fulfil(null, this.buildMessageAbort())
    await this.options.harness.redpandaDrain(mark, 2)

    return this
  }
}


export class PaymentBuilder {
  private harness!: Harness
  private transferHandler!: {
    prepare: (error: any, message: any) => Promise<any>
    fulfil: (error: any, message: any) => Promise<any>
  }
  private payerFsp!: string
  private payeeFsp!: string
  private _transferId!: string
  private _date: Date = new Date();
  private expirySeconds: number = 30;
  private _fx: boolean = false
  private amountComplex: {
    amount: string,
    currency: string
  } = { amount: '100.00', currency: 'USD' };

  deps(harness: Harness, transferHandler: {
    prepare: (error: any, message: any) => Promise<any>,
    fulfil: (error: any, message: any) => Promise<any>,
  }): this {
    this.harness = harness
    this.transferHandler = transferHandler

    return this
  }

  parties(payerFsp: string, payeeFsp: string): this {
    this.payerFsp = payerFsp
    this.payeeFsp = payeeFsp

    return this
  }

  transferId(transferId: string): this {
    this._transferId = transferId

    return this
  }

  date(date: Date): this {
    this._date = date

    return this
  }

  expiry(seconds: number): this {
    this.expirySeconds = seconds;

    return this;
  }

  fx(fx: boolean = true): this {
    this._fx = fx

    return this
  }

  amount(amount: string, currency: string = 'USD') {
    this.amountComplex = {
      amount,
      currency
    }

    return this
  }

  build(): Payment {
    assert(this.harness)
    assert(this.transferHandler)

    const options: PaymentOptions = {
      harness: this.harness,
      transferHandler: this.transferHandler,
      payerFsp: this.payerFsp,
      payeeFsp: this.payeeFsp,
      transferId: this._transferId,
      amountComplex: this.amountComplex,
      date: this._date,
      expirySeconds: this.expirySeconds,
      fx: this._fx,
    }

    return new Payment(options)
  }
}

export interface ForexOptions {
  harness: Harness,
  transferHandler: {
    prepare: (error: any, message: any) => Promise<void>
    fulfil: (error: any, message: any) => Promise<void>
  }
  commitRequestId: string,
  determiningTransferId: string,
  initiatingFsp: string,
  counterPartyFsp: string,
  amountType: 'SEND' | 'RECEIVE',
  sourceAmountComplex: { amount: string, currency: string }
  targetAmountComplex: { amount: string, currency: string }
  date: Date,
  expirySeconds: number
}

export class Forex {
  public constructor(private options: ForexOptions) { }

  public async prepare(): Promise<this> {
    const mark = this.options.harness.redpandaMark()
    await this.options.transferHandler.prepare(null, this.buildMessagePrepare())
    await this.options.harness.redpandaDrain(mark, 2)

    return this
  }

  /**
   * Build the prepare message to be passed to the kafka prepare handler.
   * Public api so we can modify it to generate invalid messages.
   */
  public buildMessagePrepare() {
    const params: PostFxTransferBuilderParams = {
      commitRequestId: this.options.commitRequestId,
      determiningTransferId: this.options.determiningTransferId,
      initiatingFsp: this.options.initiatingFsp,
      counterPartyFsp: this.options.counterPartyFsp,
      amountType: this.options.amountType,
      sourceAmount: {
        amount: this.options.sourceAmountComplex.amount,
        currency: this.options.sourceAmountComplex.currency,
      },
      targetAmount: {
        amount: this.options.targetAmountComplex.amount,
        currency: this.options.targetAmountComplex.currency
      },
      condition: '8x04dj-RKEtfjStajaKXKJ5eL1mWm9iG2ltEKvEDOHc',
      date: this.options.date,
      expirySeconds: this.options.expirySeconds,
    }

    const messageApi = buildMojaloopPostFxTransfer(params)
    const messageKafka = buildMessagePrepareFx(
      this.options.harness, messageApi
    )

    return messageKafka
  }

  public async fulfil(): Promise<this> {
    const mark = this.options.harness.redpandaMark()
    await this.options.transferHandler.fulfil(null, this.buildMessageFulfil())
    await this.options.harness.redpandaDrain(mark, 2)

    return this
  }

  public buildMessageFulfil() {
    const params: PutFxTransferBuilderParams = {
      initiatingFsp: this.options.initiatingFsp,
      counterPartyFsp: this.options.counterPartyFsp,
      fulfilment: 'uz0FAeutW6o8Mz7OmJh8ALX6mmsZCcIDOqtE01eo4uI',
      date: this.options.date,
      expirySeconds: this.options.expirySeconds,
      completedTimestamp: new Date(),
      conversionState: "RESERVED"
    }

    const messageApi = buildMojaloopPutFxTransfer(params)
    const messageKafka = buildMessageFulfilFx(
      this.options.harness,
      messageApi,
      this.options.commitRequestId
    )

    return messageKafka
  }

  public async prepareAndFulfil(): Promise<this> {
    await this.prepare()
    await this.fulfil()

    return this;
  }

  public async abort(): Promise<this> {
    const putTransfer = buildMojaloopAbortFxTransfer({
      initiatingFsp: this.options.initiatingFsp,
      counterPartyFsp: this.options.counterPartyFsp,
      date: this.options.date,
    })
    const messageKafka = buildMessageAbortFx(
      this.options.harness, putTransfer, this.options.commitRequestId,
    )
    const mark = this.options.harness.redpandaMark()
    await this.options.transferHandler.fulfil(null, messageKafka)
    await this.options.harness.redpandaDrain(mark, 2)

    return this
  }
}

export class ForexBuilder {
  private harness!: Harness
  private transferHandler!: {
    prepare: (error: any, message: any) => Promise<any>
    fulfil: (error: any, message: any) => Promise<any>
  }

  deps(harness: Harness, transferHandler: {
    prepare: (error: any, message: any) => Promise<any>,
    fulfil: (error: any, message: any) => Promise<any>,
  }): this {
    this.harness = harness
    this.transferHandler = transferHandler

    return this
  }

  commitRequestId(commitRequestId: string) {
    assert(commitRequestId)
    this._commitRequestId = commitRequestId
    return this
  }

  determiningTransferId(determiningTransferId: string) {
    assert(determiningTransferId)
    this._determiningTransferId = determiningTransferId
    return this
  }

  parties(initiatingFsp: string, counterPartyFsp: string) {
    assert(initiatingFsp)
    assert(counterPartyFsp)

    this._initiatingFsp = initiatingFsp
    this._counterPartyFsp = counterPartyFsp

    return this
  }

  amountType(amountType: 'SEND' | 'RECEIVE') {
    assert(amountType)
    this._amountType = amountType;
    return this
  }

  amountSource(amount: string, currency: string = 'USD') {
    assert(amount)
    assert(currency)
    this._sourceAmountComplex = {
      amount,
      currency
    }

    return this
  }

  amountTarget(amount: string, currency: string = 'USD') {
    assert(amount)
    assert(currency)
    this._targetAmountComplex = {
      amount,
      currency
    }

    return this
  }

  date(date: Date) {
    assert(date)
    this._date = date
    return this
  }

  expiry(seconds: number): this {
    assert(seconds)
    this._expirySeconds = seconds;

    return this;
  }

  private _commitRequestId!: string
  private _determiningTransferId!: string
  private _initiatingFsp!: string
  private _counterPartyFsp!: string
  private _amountType: 'SEND' | 'RECEIVE' = 'SEND'
  private _sourceAmountComplex: {
    amount: string,
    currency: string
  } = { amount: '100.00', currency: 'USD' }
  private _targetAmountComplex: {
    amount: string,
    currency: string
  } = { amount: '100.00', currency: 'USD' }
  private _date: Date = new Date();
  private _expirySeconds: number = 30

  build(): Forex {
    assert(this.harness, 'harness is undefined, did you forget `.deps()`?')
    assert(this.transferHandler, 'transferHandler is undefined, did you forget `.deps()`?')
    assert(this._initiatingFsp)
    assert(this._counterPartyFsp)

    const options: ForexOptions = {
      harness: this.harness,
      transferHandler: this.transferHandler,
      commitRequestId: this._commitRequestId,
      determiningTransferId: this._determiningTransferId,
      initiatingFsp: this._initiatingFsp,
      counterPartyFsp: this._counterPartyFsp,
      amountType: this._amountType,
      sourceAmountComplex: this._sourceAmountComplex,
      targetAmountComplex: this._targetAmountComplex,
      date: this._date,
      expirySeconds: this._expirySeconds,
    }

    return new Forex(options)
  }
}

export interface PostTransferBuilderParams {
  payerFsp: string,
  payeeFsp: string,
  transferId: string,
  amountComplex: {
    amount: string,
    currency: string,
  }
  date: Date,
  expirySeconds: number
}

export interface PostFxTransferBuilderParams {
  /**
   * An end-to-end identifier for the confirmation request. 
   */
  commitRequestId: string,

  /**
   * The transaction ID of the transfer to which this currency
   * conversion relates, if the conversion is part of a transfer. If
   * the conversion is a bulk currency purchase, this field should be
   * omitted.
   */
  determiningTransferId: string,

  /**
   * Identifier for the FSP who is requesting a currency conversion.
   */
  initiatingFsp: string,

  /**
   * Identifier for the FXP who is performing the currency conversion.
   */
  counterPartyFsp: string,

  /**
   * Which leg to do the currency conversion on.
   */
  amountType: 'SEND' | 'RECEIVE',

  sourceAmount: {
    amount: string,
    currency: string,
  },
  targetAmount: {
    amount: string,
    currency: string,
  }
  condition: string
  date: Date
  expirySeconds: number
}

export interface MockQuoteILPResponse {
  quoteId: string,
  transactionId: string,
  transactionType: string,
  payerFsp: string,
  payeeFsp: string,
  transferId: string,
  amountComplex: {
    amount: string,
    currency: string,
  }
  expiration: string,
}

export interface TransferRequest {
  headers: Record<string, string>,
  payload: any,
}

export interface PutTransferBuilderParams {
  payerFsp: string,
  payeeFsp: string,
  transferId: string,
  date: Date,
  transferState: 'COMMITTED' | 'RESERVED',
  amountComplex: {
    amount: string,
    currency: string,
  }
  expirySeconds: number
}

export interface PutFxTransferBuilderParams {
  /**
   * Identifier for the FSP who is requesting a currency conversion.
   */
  initiatingFsp: string,

  /**
   * Identifier for the FXP who is performing the currency conversion.
   */
  counterPartyFsp: string,

  date: Date,
  expirySeconds: number


  /**
   * The fulfilment of the condition specified for the currency
   * conversion. Mandatory if the conversion has been executed
   * successfully.
   */
  fulfilment: string,

  /**
   * Time and date when the conversion was executed.
   */
  completedTimestamp: Date,

  /**
   * The current status of the conversion request.
   */
  conversionState: 'RECEIVED' | 'RESERVED' | 'COMMITTED' | 'ABORTED',
}

export interface AbortTransferBuilderParams {
  payerFsp: string,
  payeeFsp: string,
  date: Date,
}

export interface AbortFxTransferBuilderParams {
  /**
   * Identifier for the FSP who is requesting a currency conversion.
   */
  initiatingFsp: string,

  /**
   * Identifier for the FXP who is performing the currency conversion.
   */
  counterPartyFsp: string,

  date: Date,
}

export type QuoteIlpResponse = {
  fulfilment: string;
  ilpPacket: string;
  condition: string;
}

function generateQuoteILPResponse(params: MockQuoteILPResponse): QuoteIlpResponse {
  // Build an imaginary Quote Request/Response to generate the ILP packet, fulfilment and condition.
  const quoteRequest = {
    quoteId: params.quoteId,
    transactionId: params.transactionId,
    transactionType: params.transactionType,
    payee: {
      partyIdInfo: {
        partyIdType: 'MSISDN',
        partyIdentifier: '12346',
        fspId: params.payeeFsp,
      },
    },
    payer: {
      partyIdInfo: {
        partyIdType: 'MSISDN',
        partyIdentifier: '78901',
        fspId: params.payerFsp,
      },
    },
    expiration: params.expiration
  }
  const quoteResponse = {
    transferAmount: {
      amount: params.amountComplex.amount,
      currency: params.amountComplex.currency
    },
    expiration: params.expiration,
  }

  const {
    fulfilment,
    ilpPacket,
    condition,
  } = ilpService.getQuoteResponseIlp(quoteRequest, quoteResponse)

  return {
    fulfilment, ilpPacket, condition
  }
}

/**
 * Helpers to build FSPIOP API messages.
 */

export function buildMojaloopPostTransfer(params: PostTransferBuilderParams): TransferRequest {
  const dateStr = params.date.toUTCString()
  const expiration = (new Date(params.date.getTime() + 5 * 1000 * params.expirySeconds)).toISOString()

  const headers = {
    Accept: 'application/vnd.interoperability.transfers+json;version=1.1',
    'Content-Type': 'application/vnd.interoperability.transfers+json;version=1.1',
    Date: dateStr,
    'fspiop-source': params.payerFsp,
    'fspiop-destination': params.payeeFsp,
    // not sure if we need this one
    Host: 'ml-api-adapter.local',
  }

  const mockQuoteResponse: MockQuoteILPResponse = {
    quoteId: '00001',
    transactionId: '00001',
    transactionType: 'unknown',
    payerFsp: params.payerFsp,
    payeeFsp: params.payeeFsp,
    transferId: params.transferId,
    amountComplex: {
      amount: params.amountComplex.amount,
      currency: params.amountComplex.currency,
    },
    expiration,
  }
  const { condition, ilpPacket } = generateQuoteILPResponse(mockQuoteResponse)

  const payload = {
    transferId: params.transferId,
    payerFsp: params.payerFsp,
    payeeFsp: params.payeeFsp,
    amount: {
      amount: params.amountComplex.amount,
      currency: params.amountComplex.currency,
    },
    ilpPacket,
    condition,
    expiration,
  }

  return {
    headers,
    payload
  }
}

export function buildMojaloopPostFxTransfer(params: PostFxTransferBuilderParams): TransferRequest {
  const dateStr = params.date.toUTCString()
  const expiration = (new Date(params.date.getTime() + 5 * 1000 * params.expirySeconds)).toISOString()

  const headers = {
    Accept: 'application/vnd.interoperability.transfers+json;version=1.1',
    'Content-Type': 'application/vnd.interoperability.transfers+json;version=1.1',
    Date: dateStr,
    'fspiop-source': params.initiatingFsp,
    'fspiop-destination': params.counterPartyFsp,
    Host: 'ml-api-adapter.local',
  }

  const payload = {
    commitRequestId: params.commitRequestId,
    determiningTransferId: params.determiningTransferId,
    initiatingFsp: params.initiatingFsp,
    counterPartyFsp: params.counterPartyFsp,
    amountType: params.amountType,
    sourceAmount: {
      amount: params.sourceAmount.amount,
      currency: params.sourceAmount.currency,
    },
    targetAmount: {
      amount: params.targetAmount.amount,
      currency: params.targetAmount.currency,
    },
    condition: params.condition,
    expiration
  }

  return {
    headers,
    payload
  }
}

export function buildMojaloopPutTransfer(params: PutTransferBuilderParams): TransferRequest {
  const expiration = (new Date(params.date.getTime() + 5 * 1000 * params.expirySeconds)).toISOString()

  const headers = {
    accept: 'application/vnd.interoperability.transfers+json;version=1.1',
    'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
    date: params.date.toUTCString(),
    'fspiop-destination': params.payerFsp,
    'fspiop-source': params.payeeFsp,
  }

  const mockQuoteResponse: MockQuoteILPResponse = {
    quoteId: '00001',
    transactionId: '00001',
    transactionType: 'unknown',
    payerFsp: params.payerFsp,
    payeeFsp: params.payeeFsp,
    transferId: params.transferId,
    amountComplex: {
      amount: params.amountComplex.amount,
      currency: params.amountComplex.currency,
    },
    expiration,
  }
  const { fulfilment } = generateQuoteILPResponse(mockQuoteResponse)

  const payload = {
    transferState: params.transferState,
    fulfilment,
    completedTimestamp: params.date.toISOString(),
  }

  return {
    headers,
    payload,
  }
}

export function buildMojaloopPutFxTransfer(params: PutFxTransferBuilderParams): TransferRequest {
  const expiration = (new Date(params.date.getTime() + 5 * 1000 * params.expirySeconds)).toISOString()

  const headers = {
    accept: 'application/vnd.interoperability.transfers+json;version=1.1',
    'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
    date: params.date.toUTCString(),
    'fspiop-destination': params.initiatingFsp,
    'fspiop-source': params.counterPartyFsp,
  }

  const payload = {
    conversionState: params.conversionState,
    fulfilment: params.fulfilment,
    completedTimestamp: params.date.toISOString(),
  }

  return {
    headers,
    payload,
  }
}

export function buildMojaloopAbortTransfer(params: AbortTransferBuilderParams): TransferRequest {
  const headers = {
    accept: 'application/vnd.interoperability.transfers+json;version=1.1',
    'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
    date: params.date.toUTCString(),
    'fspiop-destination': params.payerFsp,
    'fspiop-source': params.payeeFsp,
  }
  const payload = {
    // Ref: https://docs.mojaloop.io/api/fspiop/v1.1/api-definition.html#payee-errors-5-xxx
    errorInformation: {
      errorCode: '5100',
      errorDescription: 'Payer rejected the transfer'
    }
  }

  return {
    headers,
    payload,
  }
}

export function buildMojaloopAbortFxTransfer(params: AbortFxTransferBuilderParams): TransferRequest {
  const headers = {
    accept: 'application/vnd.interoperability.fxTransfers+json;version=2.0',
    'content-type': 'application/vnd.interoperability.fxTransfers+json;version=2.0',
    date: params.date.toUTCString(),
    'fspiop-destination': params.initiatingFsp,
    'fspiop-source': params.counterPartyFsp,
  }

  const payload = {
    errorInformation: {
      errorCode: '5100',
      errorDescription: 'FXP rejected the conversion'
    }
  }

  return {
    headers,
    payload,
  }
}

/**
 * Helpers to format the messages as if they were coming from ml-api-adapter.
 */
export const buildMessagePrepare = (harness: Harness, transfer: TransferRequest) => {
  const { headers, payload } = transfer
  return {
    topic: harness.topicTransferPrepare.topicName,
    value: {
      metadata: {
        event: {
          action: Enum.Events.Event.Action.PREPARE,
        }
      },
      content: {
        headers,
        payload,
      }
    }
  }
}

export const buildMessagePrepareFx = (harness: Harness, transfer: TransferRequest) => {
  const { headers, payload } = transfer
  return {
    topic: harness.topicTransferPrepare.topicName,
    value: {
      metadata: {
        event: {
          action: Enum.Events.Event.Action.FX_PREPARE,
        }
      },
      content: {
        headers,
        payload,
      }
    }
  }
}

export const buildMessageFulfil = (
  harness: Harness, transfer: TransferRequest, transferId: string
) => {
  const { headers, payload } = transfer
  return {
    topic: harness.topicTransferFulfil.topicName,
    value: {
      metadata: {
        event: {
          type: Enum.Events.Event.Action.FULFIL,
          action: Enum.Events.Event.Action.COMMIT,
        }
      },
      content: {
        uriParams: {
          id: transferId
        },
        headers,
        payload,
      }
    }
  }
}

export const buildMessageFulfilFx = (
  harness: Harness, transfer: TransferRequest, transferId: string
) => {
  const { headers, payload } = transfer
  return {
    topic: harness.topicTransferFulfil.topicName,
    value: {
      metadata: {
        event: {
          type: Enum.Events.Event.Type.FULFIL,
          action: Enum.Events.Event.Action.FX_RESERVE,
        }
      },
      content: {
        uriParams: {
          id: transferId
        },
        headers,
        payload,
      }
    }
  }
}

export const buildMessageAbort = (
  harness: Harness, transfer: TransferRequest, transferId: string
) => {
  const { headers, payload } = transfer
  return {
    topic: harness.topicTransferFulfil.topicName,
    value: {
      metadata: {
        event: {
          type: Enum.Events.Event.Action.FULFIL,
          action: Enum.Events.Event.Action.ABORT,
        }
      },
      content: {
        uriParams: {
          id: transferId
        },
        headers,
        payload,
      }
    }
  }
}

export const buildMessageAbortFx = (
  harness: Harness, transfer: TransferRequest, commitRequestId: string
) => {
  const { headers, payload } = transfer
  return {
    topic: harness.topicTransferFulfil.topicName,
    value: {
      metadata: {
        event: {
          type: Enum.Events.Event.Type.FULFIL,
          action: Enum.Events.Event.Action.FX_ABORT,
        }
      },
      content: {
        uriParams: {
          id: commitRequestId
        },
        headers,
        payload,
      }
    }
  }
}

export const buildMessageForwarded = (
  harness: Harness,
  transfer: { transferId: string, proxyId: string }
) => {
  const { transferId, proxyId } = transfer

  return {
    topic: harness.topicTransferPrepare.topicName,
    value: {
      metadata: {
        event: {
          type: Enum.Events.Event.Type.PREPARE,
          action: Enum.Events.Event.Action.FORWARDED
        }
      },
      content: {
        payload: {
          proxyId,
          transferId
        }
      }
    }
  }
}

export const buildMessageForwardedFx = (
  harness: Harness,
  fxTransfer: { commitRequestId: string, proxyId: string }
) => {
  const { commitRequestId, proxyId } = fxTransfer

  return {
    topic: harness.topicTransferPrepare.topicName,
    value: {
      metadata: {
        event: {
          type: Enum.Events.Event.Type.PREPARE,
          action: Enum.Events.Event.Action.FX_FORWARDED
        }
      },
      content: {
        payload: {
          proxyId,
          commitRequestId
        }
      }
    }
  }
}