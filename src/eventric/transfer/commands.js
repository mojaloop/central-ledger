'use strict'

const P = require('bluebird')
const Validator = require('./validator')
const Errors = require('../../errors')

module.exports = {
  PrepareTransfer (proposed) {
    const {id, ledger, debits, credits, execution_condition, expires_at} = proposed
    return P.resolve(this.$aggregate.load('Transfer', id))
    .then(existing => Validator.validateExistingOnPrepare(proposed, existing))
    .then(existing => { return { existing: true, transfer: existing } })
    .catch(Errors.AggregateNotFoundError, () => {
      return this.$aggregate.create('Transfer', {
        ledger,
        debits,
        credits,
        execution_condition,
        expires_at
      }, id)
      .then(transfer => {
        return transfer.$save().then(() => ({ existing: false, transfer }))
      })
    })
  },

  FulfillTransfer ({ id, fulfillment }) {
    return P.resolve(this.$aggregate.load('Transfer', id))
      .then(transfer => {
        return Validator.validateFulfillment(transfer, fulfillment)
        .then(({ previouslyFulfilled }) => {
          if (previouslyFulfilled) {
            return transfer
          }
          transfer.fulfill({fulfillment})
          return transfer.$save().then(() => transfer)
        })
      })
      .catch(Errors.AggregateNotFoundError, () => {
        throw new Errors.NotFoundError('The requested resource could not be found.')
      })
  },

  RejectTransfer ({ id, rejection_reason, message, requestingAccount }) {
    return P.resolve(this.$aggregate.load('Transfer', id))
      .then(transfer => {
        return Validator.validateReject(transfer, rejection_reason, requestingAccount)
        .then(result => {
          if (result.alreadyRejected) {
            return {
              alreadyRejected: true,
              transfer
            }
          }
          transfer.reject({ rejection_reason: rejection_reason, message: message }) // eslint-disable-line
          return transfer.$save().then(() => ({ alreadyRejected: false, transfer }))
        })
      })
      .catch(Errors.AggregateNotFoundError, () => {
        throw new Errors.NotFoundError('The requested resource could not be found.')
      })
  },

  SettleTransfer ({id, settlement_id}) {
    return P.resolve(this.$aggregate.load('Transfer', id))
    .then(transfer => {
      return Validator.validateSettle(transfer)
      .then(() => {
        transfer.settle({settlement_id})
        return transfer.$save().then(() => transfer)
      })
    })
    .catch(Errors.AggregateNotFoundError, () => {
      throw new Errors.NotFoundError()
    })
  }
}
