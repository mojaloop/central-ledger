'use strict'

const P = require('bluebird')
const _ = require('lodash')
const Moment = require('moment')
const TransferState = require('../../domain/transfer/state')
const CryptoConditions = require('../../crypto-conditions')
const Errors = require('../../errors')
const UrlParser = require('../../lib/urlparser')

const validateFulfillment = ({state, fulfillment, execution_condition, expires_at}, fulfillmentCondition) => {
  return P.resolve().then(() => {
    if (!execution_condition) { // eslint-disable-line
      throw new Errors.TransferNotConditionalError()
    }
    if ((state === TransferState.EXECUTED || state === TransferState.SETTLED) && fulfillment === fulfillmentCondition) {
      return {
        previouslyFulfilled: true
      }
    }

    if (state !== TransferState.PREPARED) {
      throw new Errors.InvalidModificationError(`Transfers in state ${state} may not be executed`)
    }

    if (Moment.utc().isAfter(Moment(expires_at))) {
      throw new Errors.ExpiredTransferError()
    }

    CryptoConditions.validateFulfillment(fulfillmentCondition, execution_condition)

    return {
      previouslyFulfilled: false
    }
  })
}

const validateExistingOnPrepare = (proposed, existing) => {
  return P.resolve().then(() => {
    const match = _.isMatch(existing, _.omit(proposed, ['id']))
    const conditional = !!existing.execution_condition
    const isFinal = existing.state !== TransferState.PREPARED
    if ((conditional && isFinal) || !match) {
      throw new Errors.InvalidModificationError('Transfer may not be modified in this way')
    }
    return existing
  })
}

const validateReject = ({state, rejection_reason, execution_condition, credits}, rejectionReason, requestingAccount) => {
  return P.resolve().then(() => {
    if (!execution_condition) { // eslint-disable-line
      throw new Errors.TransferNotConditionalError()
    }

    if (requestingAccount && !credits.find(c => c.account === UrlParser.toAccountUri(requestingAccount.name))) {
      throw new Errors.UnauthorizedError('Invalid attempt to reject credit')
    }

    if (state === TransferState.REJECTED && rejection_reason === rejectionReason) { // eslint-disable-line
      return { alreadyRejected: true }
    }

    if (state !== TransferState.PREPARED) {
      throw new Errors.InvalidModificationError(`Transfers in state ${state} may not be rejected`)
    }

    return { alreadyRejected: false }
  })
}

const validateSettle = ({id, state}) => {
  return P.resolve().then(() => {
    if (state !== TransferState.EXECUTED) {
      throw new Errors.UnexecutedTransferError()
    }
    return
  })
}

module.exports = {
  validateExistingOnPrepare,
  validateFulfillment,
  validateReject,
  validateSettle
}
