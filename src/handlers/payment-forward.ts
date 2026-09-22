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
import TransferService from '../domain/transfer';
import { ApplicationConfig } from '../lib/config';
import { logger } from '../shared/logger';

import { Enum } from '@mojaloop/central-services-shared';
import { assertNestedFields } from '../lib/config/util';
import { Effect } from '../messaging/message-bus';
import { LedgerSql } from '../domain/ledger/ledger-sql';

const { Type, Action } = Enum.Events.Event
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { FSPIOPErrorCodes } = ErrorHandler.Enums

interface Dependencies {
  config: ApplicationConfig,
  ledger: LedgerSql
}

export interface PaymentForwardInput {
  message: any;
  transferId: string;

}

export enum PaymentForwardResultType {
  /**
   * Forwarded message sucessfully.
   */
  PASS = 'PASS',

  /**
   * TransferId not found.
   */
  NOT_FOUND = 'NOT_FOUND',

  /**
   * Transfer is in an invalid state for forwarding.
   */
  FAIL_INVALID_STATE = 'FAIL_INVALID_STATE',

  /**
   * Catch-all Transfer failed for another reason
   */
  FAIL_OTHER = 'FAIL_OTHER',
}

export type PaymentForwardResult = {
  type: PaymentForwardResultType.PASS,
  effects: Array<Effect>
} | {
  type: PaymentForwardResultType.NOT_FOUND,
  effects: Array<Effect>
} | {
  type: PaymentForwardResultType.FAIL_INVALID_STATE,
  effects: Array<Effect>
} | {
  type: PaymentForwardResultType.FAIL_OTHER,
  effects: Array<Effect>
}

export class PaymentForwardHandler {
  constructor(private deps: Dependencies) { }

  async handle(error: any, messages: any): Promise<Array<PaymentForwardResult>> {
    if (error) {
      throw error
    }

    assert(Array.isArray(messages))
    if (messages.length === 0) {
      logger.debug('PaymentForwardHandler.handle() - received empty batch, nothing to process');
      return []
    }

    logger.debug(`PaymentForwardHandler.handle() - processing batch of ${messages.length} messages`)
    const inputs = messages.map(message => ({
      message,
      input: this.extractMessageData(message)
    }));

    const results = await Promise.allSettled(inputs.map(async ({ input }) => this.handleOne(input)))
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.type !== PaymentForwardResultType.PASS) {
        logger.info(`PaymentForwardHandler.handleOne() returned non-success: \n\t${JSON.stringify(result.value)}`)
      }
      if (result.status === 'rejected') {
        logger.error(`PaymentForwardHandler.handleOne() failed with error: \n\t${result.reason}`)
        if (result.reason.stack) logger.error(`stack\n\t${result.reason.stack}`)
      }
    })

    return results.map(result => {
      switch (result.status) {
        case 'rejected': return {
          type: PaymentForwardResultType.FAIL_OTHER,
          error: result.reason,
          effects: []
        }
        case 'fulfilled': return result.value
      }
    })
  }

  async handleOne(input: PaymentForwardInput): Promise<PaymentForwardResult> {
    const { transferId } = input

    const transfer = await TransferService.getById(transferId)
    if (!transfer) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        FSPIOPErrorCodes.ID_NOT_FOUND,
        'Forwarded transfer could not be found.'
      )
      const effect = this.buildEffectNotificationError(input, fspiopError)

      return {
        type: PaymentForwardResultType.NOT_FOUND,
        effects: [effect],
      }
    }

    if (transfer.transferState !== Enum.Transfers.TransferInternalState.RESERVED) {
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(
        `Invalid State: ${transfer.transferState}. Expected: ${Enum.Transfers.TransferInternalState.RESERVED}`
      )
      const effect = this.buildEffectNotificationError(input, fspiopError)

      return {
        type: PaymentForwardResultType.FAIL_INVALID_STATE,
        effects: [effect],
      }
    }

    // Update state to RESERVED_FORWARDED.
    await TransferService.forwardedPrepare(transferId)
    return {
      type: PaymentForwardResultType.PASS,
      effects: []
    }
  }

  private buildEffectNotificationError(
    input: PaymentForwardInput,
    fspiopError: any
  ): Effect {
    const message = structuredClone(input.message.value)
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)
    message.content.payload = apiFSPIOPError
    message.content.uriParams = { id: input.transferId }

    return {
      functionality: Type.NOTIFICATION,
      action: Action.FORWARDED,
      message,
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: apiFSPIOPError
    }
  }

  private extractMessageData(message: any): PaymentForwardInput {
    assertNestedFields(message, 'value.content.payload.transferId')
    const transferId = message.value.content.payload.transferId

    return {
      message, transferId
    }
  }
}