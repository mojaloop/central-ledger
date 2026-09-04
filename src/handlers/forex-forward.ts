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
import FxTransferService from '../domain/fx';
import { ApplicationConfig } from '../lib/config';
import { logger } from '../shared/logger';

import { Enum } from '@mojaloop/central-services-shared';
import { assertNestedFields } from '../lib/config/util';
import { Effect } from '../messaging/message-bus';

const { Type, Action } = Enum.Events.Event
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { FSPIOPErrorCodes } = ErrorHandler.Enums

interface Dependencies {
  config: ApplicationConfig,
}

export interface ForexForwardInput {
  message: any;
  commitRequestId: string;
}

export enum ForexForwardResultType {
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

export type ForexForwardResult = {
  type: ForexForwardResultType.PASS,
  effects: Array<Effect>
} | {
  type: ForexForwardResultType.NOT_FOUND,
  effects: Array<Effect>
} | {
  type: ForexForwardResultType.FAIL_INVALID_STATE,
  effects: Array<Effect>
} | {
  type: ForexForwardResultType.FAIL_OTHER,
  effects: Array<Effect>
}

export class ForexForwardHandler {
  constructor(private deps: Dependencies) { }

  async handle(error: any, messages: any): Promise<Array<ForexForwardResult>> {
    if (error) {
      throw error
    }

    assert(Array.isArray(messages))
    if (messages.length === 0) {
      logger.debug('ForexForwardHandler.handle() - received empty batch, nothing to process');
      return []
    }

    logger.debug(`ForexForwardHandler.handle() - processing batch of ${messages.length} messages`)
    const inputs = messages.map(message => ({
      message,
      input: this.extractMessageData(message)
    }));

    const results = await Promise.allSettled(inputs.map(async ({ input }) => this.handleOne(input)))
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.type !== ForexForwardResultType.PASS) {
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
          type: ForexForwardResultType.FAIL_OTHER,
          error: result.reason,
          effects: []
        }
        case 'fulfilled': return result.value
      }
    })
  }

  async handleOne(input: ForexForwardInput): Promise<ForexForwardResult> {
    const { commitRequestId } = input


    const forex = await FxTransferService.getByIdLight(commitRequestId)
    if (!forex) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        FSPIOPErrorCodes.ID_NOT_FOUND,
        'Forwarded fxTransfer could not be found.'
      )
      const effect = this.buildEffectNotificationError(input, fspiopError)

      return {
        type: ForexForwardResultType.NOT_FOUND,
        effects: [effect],
      }
    }

    if (forex.fxTransferState !== Enum.Transfers.TransferInternalState.RESERVED) {
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(
        `Invalid State: ${forex.fxTransferState}. Expected: ${Enum.Transfers.TransferInternalState.RESERVED}`
      )
      const effect = this.buildEffectNotificationError(input, fspiopError)

      return {
        type: ForexForwardResultType.FAIL_INVALID_STATE,
        effects: [effect],
      }
    }

    // Update state to RESERVED_FORWARDED.
    await FxTransferService.forwardedFxPrepare(commitRequestId)
    return {
      type: ForexForwardResultType.PASS,
      effects: []
    }
  }

  private buildEffectNotificationError(
    input: ForexForwardInput,
    fspiopError: any
  ): Effect {
    const message = structuredClone(input.message.value)
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)
    message.content.payload = apiFSPIOPError
    message.content.uriParams = { id: input.commitRequestId }

    return {
      functionality: Type.NOTIFICATION,
      action: Action.FX_FORWARDED,
      message,
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: apiFSPIOPError
    }
  }

  private extractMessageData(message: any): ForexForwardInput {
    assertNestedFields(message, 'value.content.payload.commitRequestId')
    const commitRequestId = message.value.content.payload.commitRequestId

    return {
      message, commitRequestId
    }
  }
}