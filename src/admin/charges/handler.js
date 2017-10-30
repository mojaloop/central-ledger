'use strict'

const Charges = require('../../domain/charge')
const Errors = require('../../errors')
const Sidecar = require('../../lib/sidecar')

const validateRequest = (request) => {
  return Charges.getByName(request.payload.name).then(charge => {
    if (request.payload.payer && request.payload.payee && request.payload.payer === request.payload.payee) {
      throw new Errors.ValidationError('Payer and payee should be set to \'sender\', \'receiver\', or \'ledger\' and should not have the same value.')
    }
    if (charge) {
      throw new Errors.RecordExistsError('The charge has already been created')
    }
    return request
  })
}

function entityItem (charge) {
  return {
    name: charge.name,
    id: charge.chargeId,
    charge_type: charge.chargeType,
    rate_type: charge.rateType,
    rate: charge.rate,
    minimum: charge.minimum,
    maximum: charge.maximum,
    code: charge.code,
    is_active: charge.isActive,
    created: charge.createdDate,
    payer: charge.payer,
    payee: charge.payee
  }
}

exports.create = (request, reply) => {
  Sidecar.logRequest(request)
  return validateRequest(request)
    .then(validatedRequest => Charges.create(validatedRequest.payload))
    .then(result => reply(entityItem(result)).code(201))
    .catch(reply)
}

exports.update = (request, reply) => {
  Sidecar.logRequest(request)
  return validateRequest(request)
    .then(validatedRequest => {
      return Charges.update(request.params.name, validatedRequest.payload)
    })
    .then(result => reply(entityItem(result)))
    .catch(reply)
}

exports.getAll = (request, reply) => {
  Charges.getAll()
    .then(results => results.map(entityItem))
    .then(result => reply(result))
    .catch(e => reply(e))
}
