'use strict'

const Validator = require('./validator')
const TransferService = require('../../domain/transfer')
const RejectionType = require('../../lib/enum').rejectionType
const TransferObjectTransform = require('../../domain/transfer/transform')
const NotFoundError = require('../../errors').NotFoundError
const Sidecar = require('../../lib/sidecar')
const Logger = require('@mojaloop/central-services-shared').Logger
const Boom = require('boom')

const buildGetTransferResponse = (record) => {
  if (!record) {
    throw new NotFoundError('The requested resource could not be found.')
  }
  return TransferObjectTransform.toTransfer(record)
}

exports.prepareTransfer = async function (request, h) {
  try {
    Logger.info('entering prepare transfer')
    Sidecar.logRequest(request)
    const payload = await Validator.validate(request.payload, request.params.id)
    const result = await TransferService.prepare(payload)
    return h.response(result.transfer).code((result.existing === true) ? 200 : 201)
  } catch (err) {
    throw Boom.boomify(err, {statusCode: 400, message: 'An error has occurred'})
  }
}

exports.fulfillTransfer = async function (request, h) {
  Sidecar.logRequest(request)
  const fulfilment = {
    id: request.params.id,
    fulfilment: request.payload
  }
  const transfer = await TransferService.fulfil(fulfilment)
  return h.response(transfer).code(200)
}

exports.rejectTransfer = async function (request, h) {
  Sidecar.logRequest(request)
  const rejection = {
    id: request.params.id,
    rejection_reason: RejectionType.CANCELLED,
    message: request.payload.reason,
    requestingParticipant: request.auth.credentials
  }
  const result = await TransferService.reject(rejection)
  return h.response(rejection.message).code(result.alreadyRejected ? 200 : 201)
}

exports.getTransferById = async function (request, h) {
  const record = await TransferService.getById(request.params.id)
  return buildGetTransferResponse(record)
}

exports.getTransferFulfilment = async function (request, h) {
  const result = await TransferService.getFulfilment(request.params.id)
  return h.response(result).type('text/plain')
}
