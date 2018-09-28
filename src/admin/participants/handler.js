/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

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

const currencyEntityItem = ({ currencyId, isActive, ledgerAccountTypeId }) => {
  return {
    currency: currencyId,
    ledgerAccountTypeId,
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
    let ledgerAccountTypeEnum = await request.server.methods.enums('ledgerAccountType')
    const participantCurrencyId1 = await Participant.createParticipantCurrency(participant.participantId, request.payload.currency, ledgerAccountTypeEnum.POSITION)
    const participantCurrencyId2 = await Participant.createParticipantCurrency(participant.participantId, request.payload.currency, ledgerAccountTypeEnum.SETTLEMENT)
    participant.currencyList = [await Participant.getParticipantCurrencyById(participantCurrencyId1), await Participant.getParticipantCurrencyById(participantCurrencyId2)]
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

const addLimitAndInitialPosition = async function (request, h) {
  Sidecar.logRequest(request)
  try {
    await Participant.addLimitAndInitialPosition(request.params.name, request.payload)
    return h.response().code(201)
  } catch (err) {
    throw Boom.badRequest()
  }
}

const getLimits = async function (request, h) {
  Sidecar.logRequest(request)
  try {
    const result = await Participant.getLimits(request.params.name, request.query)
    let limits = []
    if (Array.isArray(result) && result.length > 0) {
      result.forEach(item => {
        limits.push({
          currency: (item.currencyId || request.query.currency),
          limit: {
            type: item.name,
            value: item.value
          }
        })
      })
    }
    return limits
  } catch (err) {
    throw Boom.badRequest()
  }
}

const adjustLimits = async function (request, h) {
  Sidecar.logRequest(request)
  try {
    const result = await Participant.adjustLimits(request.params.name, request.payload)
    const { participantLimit } = result
    const updatedLimit = {
      currency: request.payload.currency,
      limit: {
        type: request.payload.limit.type,
        value: participantLimit.value
      }

    }
    return h.response(updatedLimit).code(200)
  } catch (err) {
    throw Boom.badRequest()
  }
}

const getPositions = async function (request, h) {
  Sidecar.logRequest(request)
  try {
    return Participant.getPositions(request.params.name, request.query)
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
  addLimitAndInitialPosition,
  getLimits,
  adjustLimits,
  getPositions
}
