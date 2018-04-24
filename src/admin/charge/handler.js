'use strict'

const Charge = require('../../domain/charge')
const Errors = require('../../errors')
const Sidecar = require('../../lib/sidecar')
// const Logger = require('@mojaloop/central-services-shared').Logger

const validateRequest = (request) => {
  return Charge.getByName(request.payload.name).then(charge => {
    if (request.payload.payerParticipantId && request.payload.payeeParticipantId && request.payload.payerParticipantId === request.payload.payeeParticipantId) {
      throw new Errors.ValidationError('Payer and payee should be set to \'sender\', \'receiver\', or \'ledger\' and should not have the same value.')
    }
    if (charge) {
      throw new Errors.RecordExistsError('The charge has already been created')
    }
    return request
  })
}

const validateExistingRecord = (request) => {
  return Charge.getByName(request.payload.name).then(charge => {
    if (!charge) {
      throw new Errors.RecordExistsError('No record currently exists with the name ' + request.payload.name)
    }
    if (!(request.params.name && request.payload.name && request.payload.name === request.params.name)) {
      throw new Errors.ValidationError('Charge names need to be the values')
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
    payerParticipantId: charge.payerParticipantId,
    payeeParticipantId: charge.payeeParticipantId
  }
}

exports.create = async function (request, h) {
  Sidecar.logRequest(request)
  const validatedRequest = await validateRequest(request)
  const result = await Charge.create(validatedRequest.payload)
  return h.response(entityItem(result)).code(201)
}

exports.update = async function (request, h) {
  Sidecar.logRequest(request)
  const validatedRequest = await validateExistingRecord(request)
  const updatedCharge = await Charge.update(request.params.name, validatedRequest.payload)
  return entityItem(updatedCharge)
}

exports.getAll = async function (request, h) {
  const results = await Charge.getAll()
  return await results.map(entityItem)
}
