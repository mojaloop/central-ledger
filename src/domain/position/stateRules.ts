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

/**
 * Decides what a position message should do, given the state its transfer is in.
 *
 * A position message can arrive more than once (Kafka producer retries, topic replays, a second
 * consumer group). The transfer's state records whether the work was already done, so a copy
 * that finds the work done is a no-op instead of being applied again or treated as an error.
 *
 * Outcomes:
 * - APPLY:           the expected state; process the message as normal
 * - ALREADY_DONE:    this message, or another path, has already done the work; no-op
 * - ALREADY_DECIDED: another decision was made before this message was processed; no-op
 * - UNEXPECTED:      the state should never be seen for this message; no-op, error log and alert
 */

import { Enum } from '@mojaloop/central-services-shared'

const State = Enum.Transfers.TransferInternalState
const Action = Enum.Events.Event.Action

export const OUTCOME = {
  APPLY: 'apply',
  ALREADY_DONE: 'already_done',
  ALREADY_DECIDED: 'already_decided',
  UNEXPECTED: 'unexpected'
} as const

export type Outcome = typeof OUTCOME[keyof typeof OUTCOME]

/** transfer state -> outcome, for one position message action */
type StateRules = ReadonlyMap<string, Outcome>

const PREPARE_RULES: StateRules = new Map<string, Outcome>([
  [State.RECEIVED_PREPARE, OUTCOME.APPLY],

  [State.RESERVED, OUTCOME.ALREADY_DONE],
  [State.RESERVED_FORWARDED, OUTCOME.ALREADY_DONE],
  [State.RECEIVED_FULFIL, OUTCOME.ALREADY_DONE],
  [State.RECEIVED_ERROR, OUTCOME.ALREADY_DONE],
  [State.RECEIVED_REJECT, OUTCOME.ALREADY_DONE],
  [State.RESERVED_TIMEOUT, OUTCOME.ALREADY_DONE],
  [State.COMMITTED, OUTCOME.ALREADY_DONE],
  [Enum.Transfers.TransferState.SETTLED, OUTCOME.ALREADY_DONE],
  [State.ABORTED_ERROR, OUTCOME.ALREADY_DONE],
  [State.ABORTED_REJECTED, OUTCOME.ALREADY_DONE],
  [State.EXPIRED_RESERVED, OUTCOME.ALREADY_DONE],

  // The timeout handler expired the transfer before it was reserved, and has notified the payer.
  [State.EXPIRED_PREPARED, OUTCOME.ALREADY_DECIDED]
])

// Any state not listed for an action is UNEXPECTED.
const RULES: ReadonlyMap<string, StateRules> = new Map([
  [Action.PREPARE, PREPARE_RULES]
])

/**
 * @param action - position message action, e.g. Enum.Events.Event.Action.PREPARE
 * @param state - the transfer's current state; missing for a transfer with no state change
 */
export const classify = (action: string, state: string | null | undefined): Outcome => {
  if (typeof state !== 'string') return OUTCOME.UNEXPECTED
  return RULES.get(action)?.get(state) ?? OUTCOME.UNEXPECTED
}
