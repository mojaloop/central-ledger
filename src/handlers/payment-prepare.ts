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

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------
 ******/

import assert from 'node:assert';
import { ApplicationConfig } from '../lib/config';
import { logger } from '../shared/logger';
import CentralServicesShared, { Enum, TransferStateEnum, Util } from '@mojaloop/central-services-shared';
import { CreateRemittanceEntityPayment, ProxyCache, TransferDeterminingCheckResult, TransferProxyObligation } from './transfer-types';
import { Effect, MessageBus } from '../messaging/message-bus';
import { assertNestedFields } from '../lib/config/util';
import { PositionHandlerV2, PositionResultType } from './position-v2';
const { Comparators } = Util
const { decodePayload } = Util.StreamingProtocol
const Participant = require('../domain/participant')
const { Type, Action } = Enum.Events.Event

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { FSPIOPError } = ErrorHandler

interface Dependencies {
  config: ApplicationConfig,
  proxyCache: ProxyCache,
  positionHandler: PositionHandlerV2
  createRemittanceEntity: CreateRemittanceEntityPayment,
  definePositionParticipant: (options: {
    isFx: boolean,
    payload: CreatePaymentDto,
    determiningTransferCheckResult: TransferDeterminingCheckResult,
    proxyObligation: TransferProxyObligation
  }) => Promise<{ messageKey: string, cyrilResult: any }>
}

export interface CreatePaymentDto {
  amount: {
    amount: string,
    currency: string
  },
  condition: string,
  expiration: string,
  ilpPacket: string,
  payeeFsp: string,
  payerFsp: string,
  transferId: string,
}

export interface FusedPrepareHandlerInput {
  message: any;
  payload: CreatePaymentDto;
  headers: any;
  transferId: string;
  action: any;
  metric: string;
  functionality: CentralServicesShared.EventTypeEnum.TRANSFER;
  actionEnum: string;
}

export enum PaymentPrepareResultType {
  /**
   * Prepare step completed validation.
   */
  PASS = 'PASS',

  /**
   * Duplicate transfer found in a finalized state.
   */
  DUPLICATE_FINAL = 'DUPLICATE_FINAL',

  /**
   * Duplicate transfer found that is still being processed.
   */
  DUPLICATE_NON_FINAL = 'DUPLICATE_NON_FINAL',

  /**
   * An existing transfer exists with this id but different parameters.
   */
  MODIFIED = 'MODIFIED',

  /**
   * Transfer failed validation.
   */
  FAIL_VALIDATION = 'FAIL_VALIDATION',

  /**
   * Transfer failed as payee didn't have sufficent liquidity.
   */
  FAIL_LIQUIDITY = 'FAIL_LIQUIDITY',

  /**
   * Catch-all Transfer failed for another reason.
   */
  FAIL_OTHER = 'FAIL_OTHER',
}

export type PaymentPrepareResult = {
  type: PaymentPrepareResultType.PASS,
  effects: Array<Effect>
} | {
  type: PaymentPrepareResultType.DUPLICATE_FINAL
  effects: Array<Effect>
  finalizedTransfer: {
    completedTimestamp: string
    transferState: 'COMMITTED' | 'ABORTED'
    fulfilment?: string
  }
} | {
  type: PaymentPrepareResultType.DUPLICATE_NON_FINAL
  effects: Array<Effect>
} | {
  type: PaymentPrepareResultType.MODIFIED
  effects: Array<Effect>
} | {
  type: PaymentPrepareResultType.FAIL_VALIDATION
  effects: Array<Effect>
  failureReasons: Array<string>
} | {
  type: PaymentPrepareResultType.FAIL_LIQUIDITY
  effects: Array<Effect>
  error: typeof FSPIOPError
} | {
  type: PaymentPrepareResultType.FAIL_OTHER
  effects: Array<Effect>
  error: typeof FSPIOPError
}

export class PaymentPrepareHandler {
  constructor(private deps: Dependencies) { }

  async handle(error: any, messages: any): Promise<Array<PaymentPrepareResult>> {
    if (error) {
      throw error
    }

    assert(Array.isArray(messages))
    if (messages.length === 0) {
      logger.debug('PaymentPrepareHandler.handle() - received empty batch, nothing to process');
      return []
    }

    logger.debug(`PaymentPrepareHandler.handle() - processing batch of ${messages.length} messages`)
    const inputs = messages.map(message => ({
      message,
      input: this.extractMessageData(message)
    }));

    // TODO: call Ledger.prepare(inputs)

    const results = await Promise.allSettled(inputs.map(async ({ input }) => this.handleOne(input)))
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.type !== PaymentPrepareResultType.PASS) {
        logger.info(`handleOne() returned non-success: \n\t${JSON.stringify(result.value)}`)
      }
      if (result.status === 'rejected') {
        logger.error(`handleOne() failed with error: \n\t${result.reason}`)
        if (result.reason.stack) logger.error(`stack\n\t${result.reason.stack}`)
      }
    })

    return results.map(result => {
      switch (result.status) {
        case 'rejected': return {
          type: PaymentPrepareResultType.FAIL_OTHER,
          error: result.reason,
          effects: []
        }
        case 'fulfilled': return result.value
      }
    })
  }

  async handleOne(input: FusedPrepareHandlerInput): Promise<PaymentPrepareResult> {
    // Check Duplication
    const remittance = this.deps.createRemittanceEntity()
    const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(
      input.payload.transferId,
      input.payload,
      remittance.getDuplicate,
      remittance.saveDuplicateHash
    )

    if (hasDuplicateId && !hasDuplicateHash) {
      // Id was reused for a different request.
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
      )
      const effect = this.buildEffectNotificationError(input, fspiopError)
      return {
        type: PaymentPrepareResultType.MODIFIED,
        effects: [effect]
      }
      // Original also covers case for BULK_PREPARE, but we don't handle that here.
    }

    // If we found the payment, we can assume it was a duplicate!
    const payment = await remittance.getByIdLight(input.payload.transferId)
    if (payment && payment.transferStateEnumeration) {
      switch (payment.transferStateEnumeration) {
        case TransferStateEnum.ABORTED: {
          return {
            type: PaymentPrepareResultType.DUPLICATE_FINAL,
            effects: [],
            finalizedTransfer: {
              completedTimestamp: payment.completedTimestamp,
              transferState: payment.transferStateEnumeration,
            }
          }
        }
        case TransferStateEnum.COMMITTED:
        case TransferStateEnum.RESERVED: {
          return {
            type: PaymentPrepareResultType.DUPLICATE_FINAL,
            effects: [],
            finalizedTransfer: {
              completedTimestamp: payment.completedTimestamp,
              transferState: payment.transferStateEnumeration,
              fulfilment: payment.fulfilment
            }
          }
        }
      }
    }

    if (hasDuplicateId) {
      return {
        type: PaymentPrepareResultType.DUPLICATE_NON_FINAL,
        effects: []
      }
    }

    let proxyObligation: TransferProxyObligation
    try {
      proxyObligation = await this.calculateProxyObligation(input.payload)
    } catch (err: any) {
      return {
        type: PaymentPrepareResultType.FAIL_VALIDATION,
        effects: [],
        failureReasons: err.message
      }
    }

    assert(proxyObligation)
    const determiningTransferCheckResult = await remittance.checkIfDeterminingTransferExists(
      proxyObligation.payloadClone,
      proxyObligation
    )

    let validationResult: Awaited<ReturnType<typeof this.validatePayloadLinkedPayment>>
    if (determiningTransferCheckResult.determiningTransferExistsInWatchList) {
      validationResult = await this.validatePayloadLinkedPayment(proxyObligation.payloadClone)
    } else {
      validationResult = await this.validatePayloadUnlinkedPayment(proxyObligation.payloadClone)
    }

    // In case the payee/payer are not 'in scheme', the proxyObligation payload clone has rewritten
    // the payer/payee to be the proxy payee/payer, so we check _this_ payload.
    // We might want to rewrite this validation, to be aware of native vs non-native payment.
    assert(validationResult)
    if (validationResult.result === 'FAIL') {
      assert(validationResult.reasons.length > 0)
      // Save the request even if it failed validation.
      // This call fails when the participants don't exist.
      await remittance.savePreparedRequest(
        input.payload,
        validationResult.reasons.toString(),
        false,
        determiningTransferCheckResult,
        proxyObligation,
      )

      return {
        type: PaymentPrepareResultType.FAIL_VALIDATION,
        effects: [],
        failureReasons: validationResult.reasons
      }
    }
    assert(validationResult.result === 'PASS')
    assert(validationResult.reasons.length === 0)

    // Save the payment as successfully prepared.
    await remittance.savePreparedRequest(
      input.payload,
      null,
      true,
      determiningTransferCheckResult,
      proxyObligation,
    )

    const effectPosition = await this.buildEffectPosition(
      input, determiningTransferCheckResult, proxyObligation
    )

    return this.handleNext({
      type: PaymentPrepareResultType.PASS,
      effects: [
        effectPosition
      ]
    })
  }

  private async handleNext(result: PaymentPrepareResult): Promise<PaymentPrepareResult> {
    if (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'UNFUSE') {
      return result
    }

    assert(this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'FUSE')
    const notifications = result.effects.filter(effect => effect.functionality === 'notification')
    const positions = result.effects
      .filter(effect => effect.functionality === 'position')
      .map(MessageBus.effectToKafkaMessage)
    const resultsPosition = await this.deps.positionHandler.handle(null, positions)
    assert(resultsPosition.length > 0, 'Expected at least one result from positionHandler.')
    // Look just at the first one to map the result type.
    const resultPosition = resultsPosition[0]
    const positionEffects = resultsPosition
      .reduce((acc: Array<Effect>, curr) => acc.concat(...curr.effects), [])

    let type: PaymentPrepareResultType
    let error
    switch (resultPosition.type) {
      case PositionResultType.PASS:
        type = PaymentPrepareResultType.PASS
        break
      case PositionResultType.FAIL_LIQUIDITY:
        type = PaymentPrepareResultType.FAIL_LIQUIDITY
        error = resultPosition.error
        break
      case PositionResultType.FAIL_OTHER:
        type = PaymentPrepareResultType.FAIL_OTHER
        error = resultPosition.error
        break
    }

    return {
      type,
      effects: [ ...notifications, ...positionEffects ],
      error,
    }
  }

  private async buildEffectPosition(
    input: FusedPrepareHandlerInput,
    determiningTransferCheckResult: TransferDeterminingCheckResult,
    proxyObligation: TransferProxyObligation,
  ): Promise<Effect> {
    const { messageKey, cyrilResult } = await this.deps.definePositionParticipant({
      payload: proxyObligation.payloadClone,
      isFx: false,
      determiningTransferCheckResult,
      proxyObligation
    })
    const messageEffect = input.message
    messageEffect.value.content.context = {
      ...messageEffect.value.content.context,
      cyrilResult
    }
    const effectPosition: Effect = {
      functionality: Type.POSITION,
      action: Action.PREPARE,
      message: messageEffect.value,
      messageKey,
      topicName: 'topic-transfer-position-batch',
      status: 'SUCCESS',
    }
    return effectPosition
  }

  private buildEffectNotificationError(
    input: FusedPrepareHandlerInput,
    fspiopError: any
  ): Effect {
    const message = structuredClone(input.message.value)
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)

    message.content.payload = apiFSPIOPError
    message.content.uriParams = { id: input.payload.transferId }

    const effect: Effect = {
      functionality: Type.NOTIFICATION,
      action: Action.PREPARE,
      message,
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: apiFSPIOPError
    }
    return effect
  }

  /**
   * Validate the payment for a simple Payment with no 'determiningTransfers'.
   * 
   * The structure of the input has been extacted and parsed, now we validate the 
   * message itself.
   */
  private async validatePayloadUnlinkedPayment(payload: CreatePaymentDto): Promise<{
    reasons: Array<string>,
    result: 'PASS' | 'FAIL'
  }> {
    const reasons: Array<string> = []
    const [leftStr, rightStr = ''] = payload.amount.amount.split('.')
    assert(leftStr !== undefined)
    assert(rightStr !== undefined)
    if (rightStr.length > this.deps.config.AMOUNT.SCALE) {
      reasons.push(
        `Amount ${payload.amount.amount} exceeds allowed scale of ${this.deps.config.AMOUNT.SCALE}`
      )
    }
    const precision = leftStr.length + rightStr.length
    if (precision > this.deps.config.AMOUNT.PRECISION) {
      reasons.push(
        `Amount ${precision} exceeds allowed precision of ${this.deps.config.AMOUNT.PRECISION}`
      )
    }

    // TODO: I think there should be a check for determiningTransferCheckResult
    // watch list? But that feels like it doesn't belong here.

    const participantPayer = await Participant.getByName(payload.payerFsp)
    if (!participantPayer) {
      reasons.push(`Participant ${payload.payerFsp} not found`)
    }
    if (participantPayer && !participantPayer.isActive) {
      reasons.push(`Participant ${payload.payerFsp} is inactive`)
    }
    const participantPayee = await Participant.getByName(payload.payeeFsp)
    if (!participantPayee) {
      reasons.push(`Participant ${payload.payerFsp} not found`)
    }
    if (participantPayee && !participantPayee.isActive) {
      reasons.push(`Participant ${payload.payerFsp} is inactive`)
    }

    if (!this.deps.config.ENABLE_ON_US_TRANSFERS) {
      if (payload.payerFsp === payload.payeeFsp) {
        reasons.push(
          'Payer FSP and Payee FSP should be different, unless on-us tranfers are allowed by the Scheme'
        )
      }
    }
    if (!payload.condition) {
      reasons.push('Condition is required for a conditional transfer')
    } else {
      const buffer = Buffer.from(payload.condition, 'base64')
      if (buffer.length !== 32) {
        logger.info(`validateInput() condition validation failed.`)
        reasons.push('Condition validation failed')
      }
    }

    if (!payload.expiration) {
      reasons.push('Expiration is required for conditional transfer')
    } else {
      if (Date.parse(payload.expiration) < Date.parse(new Date().toISOString())) {
        reasons.push(`Expiration date ${new Date(payload.expiration).toISOString()} is already in the past`)
      }
    }

    return {
      reasons,
      result: reasons.length === 0 ? 'PASS' : 'FAIL'
    }
  }

  /**
   * Validate the payment for a simple Payment with 'determiningTransfers'.
   * 
   * The structure of the input has been extacted and parsed, now we validate the 
   * message itself.
   */
  private async validatePayloadLinkedPayment(payload: CreatePaymentDto): Promise<{
    reasons: Array<string>,
    result: 'PASS' | 'FAIL'
  }> {
    const reasons: Array<string> = []
    const [leftStr, rightStr = ''] = payload.amount.amount.split('.')
    assert(leftStr)
    assert(rightStr)
    if (rightStr.length > this.deps.config.AMOUNT.SCALE) {
      reasons.push(
        `Amount ${payload.amount.amount} exceeds allowed scale of ${this.deps.config.AMOUNT.SCALE}`
      )
    }
    const precision = leftStr.length + rightStr.length
    if (precision > this.deps.config.AMOUNT.PRECISION) {
      reasons.push(
        `Amount ${precision} exceeds allowed precision of ${this.deps.config.AMOUNT.PRECISION}`
      )
    }

    // TODO: I think there should be a check for determiningTransferCheckResult
    // watch list? But that feels like it doesn't belong here.
    const participantPayer = await Participant.getByName(payload.payerFsp)
    if (!participantPayer) {
      reasons.push(`Participant ${payload.payerFsp} not found`)
    }
    if (participantPayer && !participantPayer.isActive) {
      reasons.push(`Participant ${payload.payerFsp} is inactive`)
    }
    const participantPayee = await Participant.getByName(payload.payeeFsp)
    if (!participantPayee) {
      reasons.push(`Participant ${payload.payerFsp} not found`)
    }
    if (participantPayee && !participantPayee.isActive) {
      reasons.push(`Participant ${payload.payerFsp} is inactive`)
    }

    if (!payload.condition) {
      reasons.push('Condition is required for a conditional transfer')
    } else {
      const buffer = Buffer.from(payload.condition, 'base64')
      if (buffer.length !== 32) {
        logger.info(`validateInput() condition validation failed.`)
        reasons.push('Condition validation failed')
      }
    }

    if (!payload.expiration) {
      reasons.push('Expiration is required for conditional transfer')
    } else {
      if (Date.parse(payload.expiration) < Date.parse(new Date().toISOString())) {
        reasons.push(`Expiration date ${new Date(payload.expiration).toISOString()} is already in the past`)
      }
    }

    return {
      reasons,
      result: reasons.length === 0 ? 'PASS' : 'FAIL'
    }
  }

  private extractMessageData(message: any): FusedPrepareHandlerInput {
    assertNestedFields(message, 'value.content.headers')
    assertNestedFields(message, 'value.metadata.event.action')
    assertNestedFields(message, 'value.content.payload')

    const payloadEncoded = message.value.content.payload
    const payload = decodePayload(payloadEncoded, {}) as unknown as CreatePaymentDto
    const headers = message.value.content.headers

    const transferId = payload.transferId

    const action = message.value.metadata.event.action
    assert.equal(action, 'prepare')

    // TODO: how does this work with the proxy rewrite?
    assert(headers['fspiop-source'] === payload.payerFsp, 'FSPIOP-Source header should match Payer')
    return {
      message,
      payload,
      headers,
      transferId,
      action,
      metric: `handler_transfers_${action.toLowerCase()}`,
      functionality: Enum.Events.Event.Type.TRANSFER,
      actionEnum: this.getActionEnum(action)
    };
  }

  private getActionEnum(action: string): string {
    const actionUpper = action.toUpperCase() as keyof typeof Enum.Events.Event.Action
    return Enum.Events.Event.Action[actionUpper] || actionUpper;
  }

  /**
   * @description Figure out if the participants in the Payment message are native to the scheme
   * or are proxies.
   */
  private async calculateProxyObligation(payload: CreatePaymentDto):
    Promise<TransferProxyObligation> {
    // If the proxy isn't enabled, just return the default.
    if (!this.deps.config.PROXY_CACHE_CONFIG.enabled) {
      return {
        isFx: false,
        payloadClone: { ...payload },  // just a copy of the original payload
        isInitiatingFspProxy: false,
        isCounterPartyFspProxy: false,
        initiatingFspProxyOrParticipantId: {
          inScheme: true, proxyId: null, name: payload.payerFsp
        },
        counterPartyFspProxyOrParticipantId: {
          inScheme: true, proxyId: null, name: payload.payeeFsp
        }
      }
    }

    // We need to double check the following validation logic incase of payee side currency conversion
    const payerResult = await this.deps.proxyCache.getFSPProxy(payload.payerFsp)
    const payeeResult = await this.deps.proxyCache.getFSPProxy(payload.payeeFsp, {
      validateCurrencyAccounts: true,
      accounts: [
        {
          currency: payload.amount.currency,
          accountType: Enum.Accounts.LedgerAccountType.POSITION
        }
      ]
    })
    assert(payerResult)
    assert(payeeResult)

    // Validate the not found case.
    if (payerResult.inScheme === false && payerResult.proxyId === null) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND,
        `Payer proxy or participant not found: payer: ${payload.payerFsp}.`
      )
      throw fspiopError
    }
    if (payeeResult.inScheme === false && payeeResult.proxyId === null) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND,
        `Payee proxy or participant not found: payee: ${payload.payeeFsp}.`
      )
      throw fspiopError
    }

    const isInitiatingFspProxy = !payerResult.inScheme && payerResult.proxyId !== null
    const isCounterPartyFspProxy = !payeeResult.inScheme && payeeResult.proxyId !== null

    return {
      isFx: false,
      payloadClone: {
        ...payload,
        // Reroute the proxies.
        payerFsp: isInitiatingFspProxy ? payerResult.proxyId! : payload.payerFsp,
        payeeFsp: isCounterPartyFspProxy ? payeeResult.proxyId! : payload.payeeFsp
      },
      isInitiatingFspProxy,
      isCounterPartyFspProxy,
      initiatingFspProxyOrParticipantId: payerResult,
      counterPartyFspProxyOrParticipantId: payeeResult
    }
  }
}