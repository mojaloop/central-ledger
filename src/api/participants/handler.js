'use strict'

const Participant = require('../../domain/participant')
const Config = require('../../lib/config')
const UrlParser = require('../../lib/urlParser')
const Util = require('../../lib/util')
const PositionService = require('../../domain/position')
const Errors = require('../../errors')
const Sidecar = require('../../lib/sidecar')
// const Logger = require('@mojaloop/central-services-shared').Logger
const Boom = require('boom')

const buildParticipant = (participant) => {
  return {
    id: UrlParser.toParticipantUri(participant.name),
    name: participant.name,
    ledger: Config.HOSTNAME
  }
}

const buildResponse = (participant, {net = '0'} = {}) => {
  return Util.mergeAndOmitNil(buildParticipant(participant), {
    created: participant.createdDate,
    balance: net,
    is_disabled: participant.isDisabled || false,
    credentials: participant.credentials,
    emailAddress: participant.emailAddress
  })
}

const settlementResponse = (settlement) => {
  return {
    participant_id: UrlParser.toParticipantUri(settlement.participantName),
    participant_number: settlement.participantNumber,
    routing_number: settlement.routingNumber
  }
}

const handleExistingRecord = (entity) => {
  if (entity) {
    throw new Errors.RecordExistsError()
  }
  return entity
}

const handleMissingRecord = (entity) => {
  if (!entity) {
    throw new Errors.NotFoundError('The requested resource could not be found.')
  }
  return entity
}

const getPosition = (participant) => {
  return PositionService.calculateForParticipant(participant)
    .then(handleMissingRecord)
    .then(position => buildResponse(participant, position))
}

exports.create = async function (request, h) {
  try {
    Sidecar.logRequest(request)
    const entity = await Participant.getByName(request.payload.name)
    handleExistingRecord(entity)
    const participant = await Participant.create(request.payload)
    return h.response(buildResponse(participant)).code(201)
  } catch (err) {
    throw Boom.boomify(err, {statusCode: 400, message: 'An error has occurred'})
  }
}

exports.updatePartyCredentials = async function (request, h) {
  Sidecar.logRequest(request)
  const participantName = request.params.name
  const credentials = request.auth.credentials
  const authenticated = (credentials && (credentials.is_admin || credentials.name === participantName))

  if (!authenticated) {
    throw Boom.boomify(new Errors.UnauthorizedError('Invalid attempt updating the password.'), {statusCode: 400})
  }
  const participant = await Participant.getByName(request.params.name)
  handleMissingRecord(participant)
  const updatedParticipant = await Participant.updatePartyCredentials(participant, request.payload)
  return buildParticipant(updatedParticipant)
}

exports.updateParticipantSettlement = async function (request, h) {
  Sidecar.logRequest(request)
  const participantName = request.params.name
  const credentials = request.auth.credentials
  const authenticated = (credentials && (credentials.is_admin || credentials.name === participantName))

  if (!authenticated) {
    throw new Errors.UnauthorizedError('Invalid attempt updating the settlement.')
  }
  const participant = await Participant.getByName(request.params.name)
  handleMissingRecord(participant)
  const settlement = await Participant.updateParticipantSettlement(participant, request.payload)
  return settlementResponse(settlement)
}

exports.getByName = async function (request, h) {
  Sidecar.logRequest(request)
  const participantName = request.params.name
  const credentials = request.auth.credentials
  const authenticated = (credentials && (credentials.is_admin || credentials.name === participantName))
  const participant = await Participant.getByName(request.params.name)
  handleMissingRecord(participant)
  if (authenticated) {
    return await getPosition(participant)
  } else {
    return buildParticipant(participant)
  }
}
