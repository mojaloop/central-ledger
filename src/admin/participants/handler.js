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

const addEndpoint = async function (request, h) {
  Sidecar.logRequest(request)
  try {
    await Participant.addEndpoint(request.params.name, request.payload)
    return h.response().code(201)
  } catch (err) {
    throw Boom.badRequest()
  }
}

const getEndpoint = async function (request, h) {
  Sidecar.logRequest(request)
  try {
    if (request.query.type) {
      const result = await Participant.getEndpoint(request.params.name, request.query.type)
      let endpoint = {}
      if (Array.isArray(result) && result.length > 0) {
        endpoint = {
          type: result[0].name,
          value: result[0].value
        }
      }
      return endpoint
    } else {
      const result = await Participant.getAllEndpoints(request.params.name)
      let endpoints = []
      if (Array.isArray(result) && result.length > 0) {
        result.forEach(item => {
          endpoints.push({
            type: item.name,
            value: item.value
          })
        })
      }
      return endpoints
    }
  } catch (err) {
    throw Boom.badRequest()
  }
}

const addInitialPositionAndLimits = async function (request, h) {
  Sidecar.logRequest(request)
  try {
    await Participant.addInitialPositionAndLimits(request.params.name, request.payload)
    return h.response().code(201)
  } catch (err) {
    throw Boom.badRequest()
  }
}

module.exports = {
  create,
  getAll,
  getByName,
  update,
  addEndpoint,
  getEndpoint,
  addInitialPositionAndLimits
}
