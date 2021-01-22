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

const ParticipantService = require('../../domain/participant')
const UrlParser = require('../../lib/urlParser')
const Config = require('../../lib/config')
const Util = require('@mojaloop/central-services-shared').Util
const Sidecar = require('../../lib/sidecar')
const Logger = require('@mojaloop/central-services-logger')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Enums = require('../../lib/enumCached')
const SettlementService = require('../../domain/settlement')

const LocalEnum = {
  activated: 'activated',
  disabled: 'disabled'
}

const entityItem = ({ name, createdDate, isActive, currencyList }, ledgerAccountIds) => {
  const link = UrlParser.toParticipantUri(name)
  const accounts = currencyList.map((currentValue) => {
    return {
      id: currentValue.participantCurrencyId,
      ledgerAccountType: ledgerAccountIds[currentValue.ledgerAccountTypeId],
      currency: currentValue.currencyId,
      isActive: currentValue.isActive,
      createdDate: new Date(currentValue.createdDate),
      createdBy: currentValue.createdBy
    }
  })
  return {
    name,
    id: link,
    created: createdDate,
    isActive,
    links: {
      self: link
    },
    accounts
  }
}

const handleMissingRecord = (entity) => {
  if (!entity) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND, 'The requested resource could not be found.')
  }
  return entity
}

const create = async function (request, h) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`create: request - ${JSON.stringify(request)}`)
  try {
    const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
    await ParticipantService.validateHubAccounts(request.payload.currency)
    let participant = await ParticipantService.getByName(request.payload.name)
    if (participant) {
      const currencyExists = participant.currencyList.find(currency => {
        return currency.currencyId === request.payload.currency
      })
      if (currencyExists) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, 'Participant currency has already been registered')
      }
    } else {
      const participantId = await ParticipantService.create(request.payload)
      participant = await ParticipantService.getById(participantId)
    }
    const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
    const allSettlementModels = await SettlementService.getAll()
    const settlementModels = allSettlementModels.filter(model => model.currencyId === request.payload.currency)
    if (Array.isArray(settlementModels) && settlementModels.length > 0) {
      for (const settlementModel of settlementModels) {
        const participantCurrencyId1 = await ParticipantService.createParticipantCurrency(participant.participantId, request.payload.currency, settlementModel.ledgerAccountTypeId, false)
        const participantCurrencyId2 = await ParticipantService.createParticipantCurrency(participant.participantId, request.payload.currency, settlementModel.settlementAccountTypeId, false)
        if (Array.isArray(participant.currencyList)) {
          participant.currencyList = participant.currencyList.concat([await ParticipantService.getParticipantCurrencyById(participantCurrencyId1), await ParticipantService.getParticipantCurrencyById(participantCurrencyId2)])
        } else {
          participant.currencyList = [await ParticipantService.getParticipantCurrencyById(participantCurrencyId1), await ParticipantService.getParticipantCurrencyById(participantCurrencyId2)]
        }
      }
    } else {
      const participantCurrencyId1 = await ParticipantService.createParticipantCurrency(participant.participantId, request.payload.currency, ledgerAccountTypes.POSITION, false)
      const participantCurrencyId2 = await ParticipantService.createParticipantCurrency(participant.participantId, request.payload.currency, ledgerAccountTypes.SETTLEMENT, false)
      participant.currencyList = [await ParticipantService.getParticipantCurrencyById(participantCurrencyId1), await ParticipantService.getParticipantCurrencyById(participantCurrencyId2)]
    }
    return h.response(entityItem(participant, ledgerAccountIds)).code(201)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const createHubAccount = async function (request, h) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`createHubAccount: request - ${JSON.stringify(request)}`)
  try {
    // start - To Do move to domain
    const participant = await ParticipantService.getByName(request.params.name)
    if (participant) {
      const ledgerAccountType = await ParticipantService.getLedgerAccountTypeName(request.payload.type)
      if (!ledgerAccountType) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'Ledger account type was not found.')
      }
      const accountParams = {
        participantId: participant.participantId,
        currencyId: request.payload.currency,
        ledgerAccountTypeId: ledgerAccountType.ledgerAccountTypeId,
        isActive: 1
      }
      const participantAccount = await ParticipantService.getParticipantAccount(accountParams)
      if (participantAccount) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'Hub account has already been registered.')
      }

      if (participant.participantId !== Config.HUB_ID) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'Endpoint is reserved for creation of Hub account types only.')
      }
      const isPermittedHubAccountType = Config.HUB_ACCOUNTS.indexOf(request.payload.type) >= 0
      if (!isPermittedHubAccountType) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'The requested hub operator account type is not allowed.')
      }
      const newCurrencyAccount = await ParticipantService.createHubAccount(participant.participantId, request.payload.currency, ledgerAccountType.ledgerAccountTypeId)
      if (!newCurrencyAccount) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'Participant account and Position create have failed.')
      }
      participant.currencyList.push(newCurrencyAccount.participantCurrency)
    } else {
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'Participant was not found.')
    }
    // end here : move to domain
    const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
    const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
    return h.response(entityItem(participant, ledgerAccountIds)).code(201)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getAll = async function (request) {
  Logger.isDebugEnabled && Logger.debug(`getAll: request - ${JSON.stringify(request)}`)
  const results = await ParticipantService.getAll()
  const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
  const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
  return results.map(record => entityItem(record, ledgerAccountIds))
}

const getByName = async function (request) {
  Logger.isDebugEnabled && Logger.debug(`getByName: request - ${JSON.stringify(request)}`)
  const entity = await ParticipantService.getByName(request.params.name)
  handleMissingRecord(entity)
  const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
  const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
  return entityItem(entity, ledgerAccountIds)
}

const update = async function (request) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`update: request - ${JSON.stringify(request)}`)
  try {
    const updatedEntity = await ParticipantService.update(request.params.name, request.payload)
    if (request.payload.isActive !== undefined) {
      const isActiveText = request.payload.isActive ? LocalEnum.activated : LocalEnum.disabled
      const changeLog = JSON.stringify(Object.assign({}, request.params, { isActive: request.payload.isActive }))
      Logger.isInfoEnabled && Logger.info(`Participant has been ${isActiveText} :: ${changeLog}`)
    }
    const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
    const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
    return entityItem(updatedEntity, ledgerAccountIds)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const addEndpoint = async function (request, h) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`addEndpoint: request - ${JSON.stringify(request)}`)
  try {
    await ParticipantService.addEndpoint(request.params.name, request.payload)
    return h.response().code(201)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getEndpoint = async function (request) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`getEndpoint: request - ${JSON.stringify(request)}`)
  try {
    if (request.query.type) {
      const result = await ParticipantService.getEndpoint(request.params.name, request.query.type)
      let endpoint = {}
      if (Array.isArray(result) && result.length > 0) {
        endpoint = {
          type: result[0].name,
          value: result[0].value
        }
      }
      return endpoint
    } else {
      const result = await ParticipantService.getAllEndpoints(request.params.name)
      const endpoints = []
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
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const addLimitAndInitialPosition = async function (request, h) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`addLimitAndInitialPosition: request - ${JSON.stringify(request)}`)
  try {
    await ParticipantService.addLimitAndInitialPosition(request.params.name, request.payload)
    return h.response().code(201)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getLimits = async function (request) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`getLimits: request - ${JSON.stringify(request)}`)
  try {
    const result = await ParticipantService.getLimits(request.params.name, request.query)
    const limits = []
    if (Array.isArray(result) && result.length > 0) {
      result.forEach(item => {
        limits.push({
          currency: (item.currencyId || request.query.currency),
          limit: {
            type: item.name,
            value: item.value,
            alarmPercentage: item.thresholdAlarmPercentage
          }
        })
      })
    }
    return limits
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getLimitsForAllParticipants = async function (request) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`getLimitsForAllParticipants: request - ${JSON.stringify(request)}`)
  try {
    const result = await ParticipantService.getLimitsForAllParticipants(request.query)
    const limits = []
    if (Array.isArray(result) && result.length > 0) {
      result.forEach(item => {
        limits.push({
          name: item.name,
          currency: item.currencyId,
          limit: {
            type: item.limitType,
            value: item.value,
            alarmPercentage: item.thresholdAlarmPercentage
          }
        })
      })
    }
    return limits
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const adjustLimits = async function (request, h) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`adjustLimits: request - ${JSON.stringify(request)}`)
  try {
    const result = await ParticipantService.adjustLimits(request.params.name, request.payload)
    const { participantLimit } = result
    const updatedLimit = {
      currency: request.payload.currency,
      limit: {
        type: request.payload.limit.type,
        value: participantLimit.value,
        alarmPercentage: participantLimit.thresholdAlarmPercentage
      }

    }
    return h.response(updatedLimit).code(200)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getPositions = async function (request) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`getPositions: request - ${JSON.stringify(request)}`)
  try {
    return await ParticipantService.getPositions(request.params.name, request.query)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getAccounts = async function (request) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`getAccounts: request - ${JSON.stringify(request)}`)
  try {
    return await ParticipantService.getAccounts(request.params.name, request.query)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const updateAccount = async function (request, h) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`updateAccount: request - ${JSON.stringify(request)}`)
  try {
    const enums = {
      ledgerAccountType: await Enums.getEnums('ledgerAccountType')
    }
    await ParticipantService.updateAccount(request.payload, request.params, enums)
    if (request.payload.isActive !== undefined) {
      const isActiveText = request.payload.isActive ? LocalEnum.activated : LocalEnum.disabled
      const changeLog = JSON.stringify(Object.assign({}, request.params, { isActive: request.payload.isActive }))
      Logger.isInfoEnabled && Logger.info(`Participant account has been ${isActiveText} :: ${changeLog}`)
    }
    return h.response().code(200)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const recordFunds = async function (request, h) {
  Sidecar.logRequest(request)
  Logger.isDebugEnabled && Logger.debug(`recordFunds: request - ${JSON.stringify(request)}`)
  try {
    const enums = await Enums.getEnums('all')
    await ParticipantService.recordFundsInOut(request.payload, request.params, enums)
    return h.response().code(202)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  create,
  createHubAccount,
  getAll,
  getByName,
  update,
  addEndpoint,
  getEndpoint,
  addLimitAndInitialPosition,
  getLimits,
  adjustLimits,
  getPositions,
  getAccounts,
  updateAccount,
  recordFunds,
  getLimitsForAllParticipants
}
