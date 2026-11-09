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

import CentralServicesShared, { Enum, Util } from '@mojaloop/central-services-shared'
import assert from 'node:assert'
import { ApplicationConfig } from '../lib/config'
import { logger } from '../shared/logger'

import { Ledger } from '../domain/ledger/shared/types'
import { assertNestedFields } from '../lib/config/util'
import { Effect } from '../messaging/message-bus'
import { FulfilContext } from './payment-fulfil'
const { decodePayload } = Util.StreamingProtocol

interface Dependencies {
  config: ApplicationConfig,
  ledger: Ledger
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

export interface PrepareHandlerInput {
  message: any;
  payload: CreatePaymentDto;
  headers: any;
  transferId: string;
  action: any;
  metric: string;
  functionality: CentralServicesShared.EventTypeEnum.TRANSFER;
  actionEnum: string;
}

export enum PaymentPrepareResultTag {
  FAIL_VALIDATION = 'FAIL_VALIDATION',
  MODIFIED = 'MODIFIED',
  DUPLICATE_FINAL = 'DUPLICATE_FINAL',
  DUPLICATE_NON_FINAL = 'DUPLICATE_NON_FINAL',
  FAIL_ACCOUNT_CLOSED = 'FAIL_ACCOUNT_CLOSED',
  FAIL_LIQUIDITY = 'FAIL_LIQUIDITY',
  FAIL_OTHER = 'FAIL_OTHER',
  OK = 'OK',
  PREPARE_NEXT = 'PREPARE_NEXT',
}

export type PaymentPrepareResultPartial = {
  tag: PaymentPrepareResultTag.FAIL_VALIDATION
  failureReasons: Array<string>
} | {
  tag: PaymentPrepareResultTag.MODIFIED,
} | {
  tag: PaymentPrepareResultTag.DUPLICATE_FINAL
  context: FulfilContext
} | {
  tag: PaymentPrepareResultTag.DUPLICATE_NON_FINAL
} | {
  tag: PaymentPrepareResultTag.FAIL_ACCOUNT_CLOSED
} | {
  tag: PaymentPrepareResultTag.FAIL_LIQUIDITY
} | {
  tag: PaymentPrepareResultTag.FAIL_OTHER
} | {
  tag: PaymentPrepareResultTag.OK
} | {
  // Special case for unfuse + LedgerSQL.
  tag: PaymentPrepareResultTag.PREPARE_NEXT
  effectPosition: Effect
}

export type PaymentPrepareResult = {
  input: PrepareHandlerInput
} & PaymentPrepareResultPartial

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
    const inputs = messages.map((msg) => this.extractMessageData(msg))
    return this.deps.ledger.prepare(inputs)
  }

  private extractMessageData(message: any): PrepareHandlerInput {
    assertNestedFields(message, 'value.content.headers')
    assertNestedFields(message, 'value.metadata.event.action')
    assertNestedFields(message, 'value.content.payload')

    const payloadEncoded = message.value.content.payload
    const payload = decodePayload(payloadEncoded, {}) as unknown as CreatePaymentDto
    const headers = message.value.content.headers

    const transferId = payload.transferId

    const action = message.value.metadata.event.action
    assert.equal(action, 'prepare')

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
}
