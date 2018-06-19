'use strict'

const SharedErrors = require('@mojaloop/central-services-shared')
const AggregateNotFoundError = require('./aggregate-not-found-error')
const AlreadyRolledBackError = require('./already-rolled-back')
const ExpiredTransferError = require('./expired-transfer-error')
const InvalidBodyError = require('./invalid-body')
const InvalidModificationError = require('./invalid-modification')
const MissingFulfillmentError = require('./missing-fulfilment')
const RecordExistsError = require('./record-exists-error')
const TransferNotConditionalError = require('./transfer-not-conditional')
const TransferNotFoundError = require('./transfer-not-found')
const UnauthorizedError = require('./unauthorized')
const UnexecutedTransferError = require('./unexecuted-transfer-error')
const UnmetConditionError = require('./unmet-condition')
const UnpreparedTransferError = require('./unprepared-transfer-error')
const ValidationError = require('./validation-error')

module.exports = {
  AggregateNotFoundError,
  AlreadyRolledBackError,
  ExpiredTransferError,
  InvalidBodyError,
  InvalidModificationError,
  MissingFulfillmentError,
  RecordExistsError,
  TransferNotConditionalError,
  TransferNotFoundError,
  UnauthorizedError,
  UnexecutedTransferError,
  UnmetConditionError,
  UnpreparedTransferError,
  ValidationError,
  NotFoundError: SharedErrors.NotFoundError
}
