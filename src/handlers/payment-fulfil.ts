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

import assert from 'node:assert'
import { ApplicationConfig } from '../lib/config'
import { logger } from '../shared/logger'
import { Enum, Util, EventActionEnum } from '@mojaloop/central-services-shared'
const { decodePayload } = Util.StreamingProtocol
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { FSPIOPError } = ErrorHandler
import { Effect } from "../messaging/message-bus";
import { PositionHandlerV2 } from "./position-v2";
import { assertNestedFields } from "../lib/config/util";
import { Ledger } from '../domain/ledger/shared/types';

interface Dependencies {
  config: ApplicationConfig
  ledger: Ledger
  fxService: any
  positionHandler: PositionHandlerV2
}

export type CommitPaymentDto = {
  transferState: 'COMMITTED' | 'RESERVED' | 'RESERVED_FORWARDED',
  fulfilment: string,
  completedTimestamp: string,
} | {
  transferState: 'ABORTED',
  // Not sure if this is here.
  completedTimestamp: string,
  errorInformation: {
    errorCode: string,
    errorDescription: string,
    extensionList?: {
      extension: Array<{
        key: string,
        value: string
      }>
    }
  }
}
export type CommitPaymentDtoAborted = Extract<CommitPaymentDto, { transferState: 'ABORTED' }>;

export type FulfilHandlerAction = EventActionEnum.ABORT
  | EventActionEnum.COMMIT
  | EventActionEnum.RESERVE;

export interface FulfilHandlerInput {
  message: any;
  payload: CommitPaymentDto
  headers: Record<string, any>;
  /**
   * The Mojaloop logical transfer id.
   */
  transferId: string;
  action: FulfilHandlerAction;
  eventType: string;
  kafkaTopic: string;
  /**
   * The DFSP ID of the caller, from the FSPIOP-Source header.
   */
  callerDfspId: string;

  /**
   * The DFSP ID of the destination, from the FSPIOP-Destination header.
   */
  destinationDfspId: string;
  /**
   * The FSPIOP API version from the content-type header.
   */
  apiVersion: string;
}

export enum PaymentFulfilResultType {
  /**
   * Fulfil step completed validation. Payment was either fulfilled or aborted successfully
   */
  PASS = 'PASS',

  /**
   * Duplicate payment found in a finalized state
   */
  DUPLICATE_FINAL = 'DUPLICATE_FINAL',

  /**
   * Duplicate payment found that is still being processed
   */
  DUPLICATE_NON_FINAL = 'DUPLICATE_NON_FINAL',

  /**
   * Payment failed validation.
   */
  FAIL_VALIDATION = 'FAIL_VALIDATION',

  /**
   * Catch-all Payment failed for another reason.
   */
  FAIL_OTHER = 'FAIL_OTHER',
}

export type PaymentFulfilResult = {
  type: PaymentFulfilResultType.PASS,
  effects: Array<Effect>
} | {
  type: PaymentFulfilResultType.DUPLICATE_FINAL,
  effects: Array<Effect>
} | {
  type: PaymentFulfilResultType.DUPLICATE_NON_FINAL,
  effects: Array<Effect>
  // TODO: is there a body for this?
} | {
  type: PaymentFulfilResultType.FAIL_VALIDATION,
  effects: Array<Effect>
  error: typeof FSPIOPError
} | {
  type: PaymentFulfilResultType.FAIL_OTHER
  effects: Array<Effect>
  error: typeof FSPIOPError
}

export class PaymentFulfilHandler {
  constructor(private deps: Dependencies) { }

  /**
   * Handle a batch of messages coming off of Kafka.
   */
  async handle( error: any, messages: any): Promise<Array<PaymentFulfilResult>> {
    if (error) {
      throw error
    }

    assert(Array.isArray(messages))
    if (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'FUSE') {
      assert(
        this.deps.positionHandler,
        'PaymentFulfilHandler.deps.positionHandler not defined, positions are in `FUSE` mode.')
    }

    if (messages.length === 0) {
      logger.debug('PaymentFulfilHandler.handle() - received empty batch, nothing to process');
      return []
    }
    logger.debug(`PaymentFulfilHandler.handle() - processing batch of ${messages.length} messages`)
    const inputs = messages
      .map(message => this.extractMessageData(message))
      .filter(input => {
        // This check should happen at the ml-api-adapter. Central-ledger shoudn't have to worry
        // about validating the messages based on the API version, in fact it shouldn't have any
        // notion of 'apiVersion' at all.
        if (input.apiVersion === '1.0' && input.payload.transferState === 'RESERVED') {
          logger.error(`TransferState 'RESERVE' is not supported in FSPIOP v1.0. Ignoring this message.`)
          return false
        }
        return true
      })
    if (inputs.length === 0) {
      return []
    }
    return this.deps.ledger.fulfil(inputs)
  }

  private extractMessageData(message: any): FulfilHandlerInput {
    assertNestedFields(message, 'value.metadata.event')

    const payloadEncoded = message.value.content.payload
    const payload = decodePayload(payloadEncoded, {}) as CommitPaymentDto
    const eventType = message.value.metadata.event.type;
    const headers = message.value.content.headers;

    const contentTypeStr = headers['content-type']
    assert(contentTypeStr, 'No `content-type` header found.')
    assert(typeof contentTypeStr === 'string', '`content-type` header should be a string')
    const [_, apiVersionStr] = contentTypeStr.split('=')
    assert(apiVersionStr, 'Malformed `content-type` string.')

    assert(message.value.content.uriParams)
    assert(message.value.content.uriParams.id)
    const transferId = message.value.content.uriParams.id
    assert(transferId, 'could not parse transferId')

    const actionStr = message.value.metadata.event.action
    assert(actionStr)
    let action: FulfilHandlerAction
    switch (actionStr) {
      case Enum.Events.Event.Action.ABORT:
      case Enum.Events.Event.Action.COMMIT:
      case Enum.Events.Event.Action.RESERVE:
        action = actionStr as FulfilHandlerAction
        break;
      case Enum.Events.Event.Action.BULK_ABORT:
      case Enum.Events.Event.Action.BULK_COMMIT:
      default:
        throw new Error(`FusedFulfilHandler.extractMessageData() - unexpected action: ${actionStr}.`)
    }

    // Extract caller DFSP ID from FSPIOP-Source header.
    const callerDfspId = headers['fspiop-source'];
    assert(callerDfspId, '`callerDfspId` is required.');
    assert(typeof callerDfspId === 'string', '`callerDfspId` must be a string.');
    const destinationDfspId = headers['fspiop-destination']
    assert(destinationDfspId, '`destinationDfspId` is required.');
    assert(typeof destinationDfspId === 'string', '`destinationDfspId` must be a string.');

    return {
      message,
      payload,
      headers,
      transferId,
      action,
      eventType,
      kafkaTopic: message.topic,
      callerDfspId,
      destinationDfspId,
      apiVersion: apiVersionStr
    };
  }
}
