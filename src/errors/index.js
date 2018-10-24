'use strict'

const SharedErrors = require('@mojaloop/central-services-shared')
const AlreadyRolledBackError = require('./already-rolled-back')
const ExpiredTransferError = require('./expired-transfer-error')
const InvalidBodyError = require('./invalid-body')
const InvalidModificationError = require('./invalid-modification')
const MissingFulfilmentError = require('./missing-fulfilment')
const RecordExistsError = require('./record-exists-error')
const TransferNotConditionalError = require('./transfer-not-conditional')
const TransferNotFoundError = require('./transfer-not-found')
const UnauthorizedError = require('./unauthorized')
const UnexecutedTransferError = require('./unexecuted-transfer-error')
const UnmetConditionError = require('./unmet-condition')
const UnpreparedTransferError = require('./unprepared-transfer-error')
const ValidationError = require('./validation-error')
const ParticipantNotFoundError = require('./participant_not_found')
const LedgerAccountTypeNotFoundError = require('./ledgerAcoountTypeNotFound')
const AccountReservedForHubOperatorError = require('./accountReservedForHubOperator')
const ParticipantAccountExistError = require('./ParticipantAccountExist')
const ParticipantAccountCreateError = require('./ParticipantAccountCreate')

module.exports = {
  AlreadyRolledBackError,
  ExpiredTransferError,
  InvalidBodyError,
  InvalidModificationError,
  LedgerAccountTypeNotFoundError,
  MissingFulfilmentError,
  ParticipantNotFoundError,
  RecordExistsError,
  TransferNotConditionalError,
  TransferNotFoundError,
  UnauthorizedError,
  UnexecutedTransferError,
  UnmetConditionError,
  UnpreparedTransferError,
  ValidationError,
  AccountReservedForHubOperatorError,
  ParticipantAccountCreateError,
  ParticipantAccountExistError,
  NotFoundError: SharedErrors.NotFoundError
}
