'use strict'

const Participant = require('../../domain/participant')
const Errors = require('../../errors')
const UrlParser = require('../../lib/urlparser')
const Sidecar = require('../../lib/sidecar')
const Boom = require('boom')

const entityItem = ({name, createdDate, isDisabled, currencyId}) => {
  const link = UrlParser.toParticipantUri(name)
  return {
    name,
    id: link,
    currency: currencyId,
    created: createdDate,
    is_disabled: isDisabled,
    '_links': {
      self: link
    } // ,
    // emailAddress: name + '@test.com'
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

const create = async function (request, h) {
  Sidecar.logRequest(request)
  try {
    const entity = await Participant.getByName(request.payload.name)
    await handleExistingRecord(entity)
    const participantId = await Participant.create(request.payload)
    const participant = await Participant.getById(participantId)
    return h.response(entityItem(participant)).code(201)
  } catch (err) {
    throw Boom.badRequest(err.message)
  }
}

const getAll = async function (request, h) {
  const results = await Participant.getAll()
  const result = results.map(entityItem)
  return result
}

const getByName = async function (request, h) {
  const entity = await Participant.getByName(request.params.name)
  handleMissingRecord(entity)
  return entityItem(entity)
}

const update = async function (request, h) {
  Sidecar.logRequest(request)
  try {
    const updatedEntity = await Participant.update(request.params.name, request.payload)
    return await entityItem(updatedEntity)
  } catch (err) {
    throw Boom.badRequest()
  }
}

module.exports = {
  create,
  getAll,
  getByName,
  update
}
