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
 - Shashikant Hirugade <shirugade@mojaloop.io>

 --------------
 ******/

import Metrics from '@mojaloop/central-services-metrics'
import { logger as Logger } from '../../shared/logger'
import { OUTCOME, Outcome } from './stateRules'

/**
 * Counts and logs a position message that was not applied because of its transfer's (or
 * fxTransfer's) state. Leaves binItem.result alone: use this when the caller still sends a reply,
 * as a commit does for an aborted or expired transfer.
 *
 * @param action - position message action, e.g. Enum.Events.Event.Action.PREPARE
 * @param id - transferId, or commitRequestId for an fxTransfer
 * @param outcome - the non-APPLY outcome from StateRules.classify
 * @param state - the state the message found; missing for a transfer with no state change
 */
export const countSkippedMessage = (
  action: string,
  id: string,
  outcome: Outcome,
  state: string | null | undefined
): void => {
  Metrics.getCounter(
    'position_message_skipped',
    'Position messages skipped because of the transfer state',
    ['action', 'outcome', 'state']
  ).inc({ action, outcome, state: state || 'none' })

  const message = `position message skipped - action: ${action}, id: ${id}, state: ${state}, outcome: ${outcome}`
  if (outcome === OUTCOME.UNEXPECTED) {
    Logger.isErrorEnabled && Logger.error(message)
  } else if (outcome === OUTCOME.ALREADY_DECIDED) {
    Logger.isWarnEnabled && Logger.warn(message)
  } else {
    Logger.isDebugEnabled && Logger.debug(message)
  }
}

/**
 * Records a position message that was skipped because of its transfer's (or fxTransfer's) state,
 * and sends nothing for it.
 *
 * The message counts as processed: binItem.result is set to success, so the batch goes on. It is
 * spread into the `transfer_position` histogram, whose only labels are `success` and `action`, so no
 * other fields are added to it.
 *
 * @param binItem - the bin item of the skipped message
 * @param action - position message action, e.g. Enum.Events.Event.Action.PREPARE
 * @param id - transferId, or commitRequestId for an fxTransfer
 * @param outcome - the non-APPLY outcome from StateRules.classify
 * @param state - the state the message found; missing for a transfer with no state change
 */
export const recordSkippedMessage = (
  binItem: { result?: unknown },
  action: string,
  id: string,
  outcome: Outcome,
  state: string | null | undefined
): void => {
  binItem.result = { success: true }
  countSkippedMessage(action, id, outcome, state)
}
