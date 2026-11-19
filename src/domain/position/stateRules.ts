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

  // The timeout handler expired the transfer before it was reserved. Notifying the payer is the
  // timeout handler's job, not this message's.
  [State.EXPIRED_PREPARED, OUTCOME.ALREADY_DECIDED]
])

// Enum.Transfers.TransferInternalState.RECEIVED_FULFIL_DEPENDENT exists at runtime, but is missing
// from the central-services-shared type definitions.
const RECEIVED_FULFIL_DEPENDENT = 'RECEIVED_FULFIL_DEPENDENT'

// An fxTransfer goes through the same states, plus RECEIVED_FULFIL_DEPENDENT.
const FX_PREPARE_RULES: StateRules = new Map<string, Outcome>([
  ...PREPARE_RULES,

  // The FXP has fulfilled the conversion, which waits for its determining transfer to commit.
  [RECEIVED_FULFIL_DEPENDENT, OUTCOME.ALREADY_DONE]
])

// COMMIT and RESERVE: the fulfil handler wrote RECEIVED_FULFIL before sending the message.
const COMMIT_RULES: StateRules = new Map<string, Outcome>([
  [State.RECEIVED_FULFIL, OUTCOME.APPLY],

  // An earlier copy of this message committed the transfer.
  [State.COMMITTED, OUTCOME.ALREADY_DONE],
  [Enum.Transfers.TransferState.SETTLED, OUTCOME.ALREADY_DONE],

  // The timeout handler, or an error or abort, decided the transfer before this message was
  // processed, so the payee's fulfil was not applied.
  [State.RESERVED_TIMEOUT, OUTCOME.ALREADY_DECIDED],
  [State.EXPIRED_RESERVED, OUTCOME.ALREADY_DECIDED],
  [State.RECEIVED_ERROR, OUTCOME.ALREADY_DECIDED],
  [State.ABORTED_ERROR, OUTCOME.ALREADY_DECIDED],
  [State.ABORTED_REJECTED, OUTCOME.ALREADY_DECIDED]
])

// ABORT and ABORT_VALIDATION: the fulfil handler wrote RECEIVED_ERROR before sending the message.
const ABORT_RULES: StateRules = new Map<string, Outcome>([
  [State.RECEIVED_ERROR, OUTCOME.APPLY],

  // An earlier copy of this message released the reservation, or the timeout handler did.
  [State.ABORTED_ERROR, OUTCOME.ALREADY_DONE],
  [State.EXPIRED_RESERVED, OUTCOME.ALREADY_DONE],

  // The timeout handler decided the transfer; its TIMEOUT_RESERVED message releases the reservation.
  [State.RESERVED_TIMEOUT, OUTCOME.ALREADY_DECIDED],

  // A fulfil was also accepted for the transfer: two different decisions.
  [State.RECEIVED_FULFIL, OUTCOME.ALREADY_DECIDED],
  [State.COMMITTED, OUTCOME.ALREADY_DECIDED],
  [Enum.Transfers.TransferState.SETTLED, OUTCOME.ALREADY_DECIDED]
])

// FX_RESERVE: the fx fulfil handler wrote RECEIVED_FULFIL_DEPENDENT before sending the message.
// It moves no funds and writes no state when it applies.
const FX_RESERVE_RULES: StateRules = new Map<string, Outcome>([
  [RECEIVED_FULFIL_DEPENDENT, OUTCOME.APPLY],

  // The determining transfer committed the conversion after this message was first processed.
  [State.COMMITTED, OUTCOME.ALREADY_DONE],
  [Enum.Transfers.TransferState.SETTLED, OUTCOME.ALREADY_DONE],

  // An error, abort or timeout decided the conversion first.
  [State.RECEIVED_ERROR, OUTCOME.ALREADY_DECIDED],
  [State.ABORTED_ERROR, OUTCOME.ALREADY_DECIDED],
  [State.ABORTED_REJECTED, OUTCOME.ALREADY_DECIDED],
  [State.RESERVED_TIMEOUT, OUTCOME.ALREADY_DECIDED],
  [State.EXPIRED_RESERVED, OUTCOME.ALREADY_DECIDED]
])

// Any state not listed for an action is UNEXPECTED.
const RULES: ReadonlyMap<string, StateRules> = new Map([
  [Action.PREPARE, PREPARE_RULES],
  [Action.FX_PREPARE, FX_PREPARE_RULES],
  [Action.COMMIT, COMMIT_RULES],
  [Action.RESERVE, COMMIT_RULES],
  [Action.ABORT, ABORT_RULES],
  [Action.ABORT_VALIDATION, ABORT_RULES],
  [Action.FX_RESERVE, FX_RESERVE_RULES]
])

/**
 * Steps of an FX commit or abort chain (cyrilResult.positionChanges). A chain applies one step per
 * message; each step changes one part: the transfer, or one fxTransfer.
 */
export const STEP = {
  // A commit step on an fxTransfer: the FXP fulfilled it, and it waits for its determining transfer.
  FX_COMMIT: 'fx-commit-step',
  // A release step on any part (the transfer or an fxTransfer) of an FX abort or FX-linked abort.
  RELEASE: 'release-step'
} as const

export type Step = typeof STEP[keyof typeof STEP]

const FX_COMMIT_STEP_RULES: StateRules = new Map<string, Outcome>([
  [RECEIVED_FULFIL_DEPENDENT, OUTCOME.APPLY],

  // An earlier copy of this step committed the fxTransfer.
  [State.COMMITTED, OUTCOME.ALREADY_DONE],
  [Enum.Transfers.TransferState.SETTLED, OUTCOME.ALREADY_DONE],

  // The conversion was aborted or expired while the transfer was being committed: two decisions.
  [State.RECEIVED_ERROR, OUTCOME.ALREADY_DECIDED],
  [State.ABORTED_ERROR, OUTCOME.ALREADY_DECIDED],
  [State.ABORTED_REJECTED, OUTCOME.ALREADY_DECIDED],
  [State.RESERVED_TIMEOUT, OUTCOME.ALREADY_DECIDED],
  [State.EXPIRED_RESERVED, OUTCOME.ALREADY_DECIDED]
])

const RELEASE_STEP_RULES: StateRules = new Map<string, Outcome>([
  // The part whose error started the abort, or a linked part that still holds its reservation.
  [State.RECEIVED_ERROR, OUTCOME.APPLY],
  [State.RESERVED, OUTCOME.APPLY],
  [State.RESERVED_FORWARDED, OUTCOME.APPLY],
  [RECEIVED_FULFIL_DEPENDENT, OUTCOME.APPLY],

  // An earlier copy of this step released the part, or the timeout handler did.
  [State.ABORTED_ERROR, OUTCOME.ALREADY_DONE],
  [State.EXPIRED_RESERVED, OUTCOME.ALREADY_DONE],

  // The part was committed (or is being committed): two decisions.
  [State.RECEIVED_FULFIL, OUTCOME.ALREADY_DECIDED],
  [State.COMMITTED, OUTCOME.ALREADY_DECIDED],
  [Enum.Transfers.TransferState.SETTLED, OUTCOME.ALREADY_DECIDED],

  // The timeout handler decided the part; its own message releases it.
  [State.RESERVED_TIMEOUT, OUTCOME.ALREADY_DECIDED]
])

const STEP_RULES: ReadonlyMap<string, StateRules> = new Map([
  [STEP.FX_COMMIT, FX_COMMIT_STEP_RULES],
  [STEP.RELEASE, RELEASE_STEP_RULES]
])

/**
 * The kind of decision an FX chain carries out, for the check on its starting part: the transfer
 * (FX commit, FX-linked abort) or the fxTransfer named in the message (FX abort).
 */
export const CHAIN = {
  COMMIT: 'commit',
  ABORT: 'abort'
} as const

export type Chain = typeof CHAIN[keyof typeof CHAIN]

// The starting part is still in the chain's decision, or already at that decision's outcome: the
// starting part's own step may come before the other steps of the chain.
const CHAIN_STARTING_STATES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  [CHAIN.COMMIT, new Set<string>([State.RECEIVED_FULFIL, State.COMMITTED])],
  [CHAIN.ABORT, new Set<string>([State.RECEIVED_ERROR, State.ABORTED_ERROR])]
])

/**
 * @param action - position message action, e.g. Enum.Events.Event.Action.PREPARE
 * @param state - the transfer's (or fxTransfer's) current state; missing if it has no state change
 */
export const classify = (action: string, state: string | null | undefined): Outcome => {
  if (typeof state !== 'string') return OUTCOME.UNEXPECTED
  return RULES.get(action)?.get(state) ?? OUTCOME.UNEXPECTED
}

/**
 * Classifies one step of an FX chain by the current state of the part it changes.
 * @param step - STEP.FX_COMMIT or STEP.RELEASE
 * @param state - the step's part's current state; missing if it has no state change
 */
export const classifyStep = (step: Step, state: string | null | undefined): Outcome => {
  if (typeof state !== 'string') return OUTCOME.UNEXPECTED
  return STEP_RULES.get(step)?.get(state) ?? OUTCOME.UNEXPECTED
}

/**
 * Whether an FX chain can go on, given the state of its starting part. False means the chain's
 * decision has been overtaken by another one, whose own chain (or the timeout) handles every part.
 * @param chain - CHAIN.COMMIT or CHAIN.ABORT
 * @param state - the starting part's current state
 */
export const isChainStartingState = (chain: Chain, state: string | null | undefined): boolean =>
  typeof state === 'string' && (CHAIN_STARTING_STATES.get(chain)?.has(state) ?? false)

/**
 * The part a chain step changes: the fxTransfer's commitRequestId, or the transferId.
 */
export const stepPartId = (step: { isFxTransferStateChange?: boolean, commitRequestId?: string, transferId?: string }): string | undefined =>
  step.isFxTransferStateChange ? step.commitRequestId : step.transferId

/**
 * Whether a step comes after another step for the same part in its chain. An abort chain has one
 * step per reserved position change, so a part reserved twice (old data) has two steps: the second
 * finds the part already released by the first, and must go on rather than stop as a copy would.
 */
export const hasEarlierStepForSamePart = (steps: Array<{ isFxTransferStateChange?: boolean, commitRequestId?: string, transferId?: string }>, index: number): boolean => {
  const partId = stepPartId(steps[index])
  return steps.slice(0, index).some(step => !!step.isFxTransferStateChange === !!steps[index].isFxTransferStateChange && stepPartId(step) === partId)
}
