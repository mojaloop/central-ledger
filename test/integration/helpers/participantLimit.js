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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Model = require('../../../src/domain/participant')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const limitAndInitialPositionSampleData = {
  currency: 'USD',
  limit: {
    type: 'NET_DEBIT_CAP',
    value: 10000000
  },
  initialPosition: 0
}

exports.prepareLimitAndInitialPosition = async (participantName, limitAndInitialPositionObj = {}) => {
  try {
    const limitAndInitialPosition = {
      currency: limitAndInitialPositionObj.currency || limitAndInitialPositionSampleData.currency,
      limit: {
        type: limitAndInitialPositionObj.limit.type || limitAndInitialPositionSampleData.limit.type,
        value: limitAndInitialPositionObj.limit.value || limitAndInitialPositionSampleData.limit.value
      },
      initialPosition: limitAndInitialPositionObj.initialPosition || limitAndInitialPositionSampleData.initialPosition
    }
    await Model.addLimitAndInitialPosition(participantName, limitAndInitialPosition)
    return {
      participantPosition: {
        value: limitAndInitialPositionObj.initialPosition || limitAndInitialPositionSampleData.initialPosition
      }
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.adjustLimits = async (participantName, limitObj = {}) => {
  try {
    const limit = {
      currency: limitObj.currency || limitAndInitialPositionSampleData.currency,
      limit: {
        type: limitObj.limit.type || limitAndInitialPositionSampleData.limit.type,
        value: limitObj.limit.value || limitAndInitialPositionSampleData.limit.value
      }
    }
    return Model.adjustLimits(participantName, limit)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.deleteInitialPositionData = async (participantName) => {
  if (!participantName) {
    throw new Error('Please provide a valid participant name!')
  }

  try {
    return await Model.destroyParticipantPositionByNameAndCurrency(participantName, limitAndInitialPositionSampleData.currency)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.deleteInitialLimitData = async (participantName) => {
  if (!participantName) {
    throw new Error('Please provide a valid participant name!')
  }

  try {
    return await Model.destroyParticipantLimitByNameAndCurrency(participantName, limitAndInitialPositionSampleData.currency)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
