/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
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

 * Infitx
 - Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

const { Enum } = require('@mojaloop/central-services-shared')

const TABLE_NAMES = Object.freeze({
  externalParticipant: 'externalParticipant',
  fxTransfer: 'fxTransfer',
  fxTransferDuplicateCheck: 'fxTransferDuplicateCheck',
  fxTransferErrorDuplicateCheck: 'fxTransferErrorDuplicateCheck',
  fxTransferFulfilmentDuplicateCheck: 'fxTransferFulfilmentDuplicateCheck',
  fxTransferParticipant: 'fxTransferParticipant',
  fxTransferStateChange: 'fxTransferStateChange',
  fxTransferExtension: 'fxTransferExtension',
  fxWatchList: 'fxWatchList',
  transferDuplicateCheck: 'transferDuplicateCheck',
  participantPositionChange: 'participantPositionChange'
})

const FX_METRIC_PREFIX = 'fx_'
const FORWARDED_METRIC_PREFIX = 'fwd_'

const PROM_METRICS = Object.freeze({
  transferGet: (isFx) => `${isFx ? FX_METRIC_PREFIX : ''}transfer_get`,
  transferPrepare: (isFx, isForwarded) => `${isFx ? FX_METRIC_PREFIX : ''}${isForwarded ? FORWARDED_METRIC_PREFIX : ''}transfer_prepare`,
  transferFulfil: (isFx) => `${isFx ? FX_METRIC_PREFIX : ''}transfer_fulfil`,
  transferFulfilError: (isFx) => `${isFx ? FX_METRIC_PREFIX : ''}transfer_fulfil_error`
})

const ERROR_MESSAGES = Object.freeze({
  fxTransferNotFound: 'fxTransfer not found',
  fxTransferHeaderSourceValidationError: `${Enum.Http.Headers.FSPIOP.SOURCE} header does not match counterPartyFsp on the fxFulfil callback response`,
  fxTransferHeaderDestinationValidationError: `${Enum.Http.Headers.FSPIOP.DESTINATION} header does not match initiatingFsp on the fxFulfil callback response`,
  fxInvalidFulfilment: 'Invalid FX fulfilment',
  fxTransferNonReservedState: 'Non-RESERVED fxTransfer state',
  fxTransferExpired: 'fxTransfer expired',
  invalidApiErrorCode: 'API specification undefined errorCode',
  invalidEventType: type => `Invalid event type:(${type})`,
  invalidAction: action => `Invalid action:(${action})`,
  invalidFxTransferState: ({ transferStateEnum, action, type }) => `Invalid fxTransferStateEnumeration:(${transferStateEnum}) for event action:(${action}) and type:(${type})`,
  fxActionIsNotAllowed: action => `action ${action} is not allowed into fxFulfil handler`,
  noFxDuplicateHash: 'No fxDuplicateHash found',
  transferNotFound: 'transfer not found'
})

const DB_ERROR_CODES = Object.freeze({
  duplicateEntry: 'ER_DUP_ENTRY'
})

// Acceptable range for position batch handler's batch size
const BATCHING = {
  MIN: 1,
  MAX: 100_000
}

const TIMEOUT_HANDLER_DIST_LOCK_KEY = 'mutex:cl-timeout-handler'

module.exports = {
  DB_ERROR_CODES,
  ERROR_MESSAGES,
  TABLE_NAMES,
  PROM_METRICS,
  BATCHING,
  TIMEOUT_HANDLER_DIST_LOCK_KEY
}
