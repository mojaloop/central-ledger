'use strict'

const Participant = require('../../domain/participant')
const Errors = require('../../errors')
const UrlParser = require('../../lib/urlParser')
const Sidecar = require('../../lib/sidecar')
const Boom = require('boom')

const entityItem = ({ name, createdDate, isActive, currencyList }) => {
  const link = UrlParser.toParticipantUri(name)
  const currencies = currencyList.map(currencyEntityItem)
  return {
    name,
    id: link,
    created: createdDate,
    isActive,
    links: {
      self: link
    },
    currencies
  }
}

const currencyEntityItem = ({ currencyId, isActive }) => {
  return {
    currency: currencyId,
    isActive
  }
}

// const handleExistingRecord = (entity) => {
//   if (entity) {
//     throw new Errors.RecordExistsError()
//   }
//   return entity
// }

const handleMissingRecord = (entity) => {
  if (!entity) {
    throw new Errors.NotFoundError('The requested resource could not be found.')
  }
  return entity
}

const create = async function (request, h) {
  Sidecar.logRequest(request)
  try {
    let participant = await Participant.getByName(request.payload.name)
    if (participant) {
      const currencyExists = participant.currencyList.find(currency => {
        return currency.currencyId === request.payload.currency
      })
      if (currencyExists) {
        throw new Errors.RecordExistsError()
      }
    } else {
      const participantId = await Participant.create(request.payload)
      participant = await Participant.getById(participantId)
    }
    const participantCurrencyId = await Participant.createParticipantCurrency(participant.participantId, request.payload.currency)
    participant.currencyList = [await Participant.getParticipantCurrencyById(participantCurrencyId)]
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
