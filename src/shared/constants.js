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

module.exports = {
  DB_ERROR_CODES,
  ERROR_MESSAGES,
  TABLE_NAMES,
  PROM_METRICS
}
