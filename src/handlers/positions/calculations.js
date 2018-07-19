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

 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

 /*
 * Message from prepare topic
 {
  "id": "<transferMessage.transferId>",
  "from": "<transferMessage.payerFsp",
  "to": "<transferMessage.payeeFsp",
  "type": "application/json",
  "content": {
    "headers": "<transferHeaders>",
    "payload": "<transferMessage>"
  },
  "metadata": {
    "event": {
      "id": "<uuid>",
      "responseTo": "<previous.uuid>",
      "type": "transfer",
      "action": "prepare",
      "createdAt": "<timestamp>",
      "state": {
        "status": "success",
        "code": 0
      }
    }
  }
}
*/
'use strict'

const participantFacade = require('../../models/participant/facade')
const participantModel = require('../../models/participant/participant')
const positionFacade = require('../../models/position/facade')
const positionModel = require('../../models/position/participantPosition')
const positionLimitModel = require('../../models/position/participantLimit')
const transferStateModel = require('../../models/transfer/transferStateChange')
const transferStates = require('../../lib/enum').TransferState

/**
 * @module src/handlers/positions/calculations
 */

/**
* @param messages
*/

const calculateSumInBatch = async (messages) => {
  let transferIdsList = []
  let sumInBatch = 0
  for (let message of messages) {
    transferIdsList.push[message.id]
    sumInBatch += message.payload.amount.amount
  }
  let transferStateChangeList = await transferStateModel.getByTransferIdList(transferIdsList)
  return { transferIdsList, transferStateChangeList, sumInBatch }
}

/**
* @param messages
* @param sumTransfersInBatch
*/

const calculateSingleMessage = async ({ message, batchMap }) => {
  // validate (maybe from array from getWhereIn?)
  const { currency, amount } = message.payload.amount
  const transferId = message.id
  const batchElement = batchMap.get(currency)
  let { sumTransfersInBatch } = batchElement
  let participant = await participantFacade.getByNameAndCurrency(message.from, currency)
  // 7 8 9 10 11
  let { currentPosition, reservedPosition } = await positionFacade.updateParticipantPositionTransaction(participant.participantCurrencyId, sumTransfersInBatch)
  // 12 13 14
  const participantPositionLimit = await positionLimitModel.getLimitByCurrencyId(participant.participantCurrencyId)
  // 17
  let currentAvailablePosition = participantPositionLimit.value - currentPosition - reservedPosition
  // 18
  let success = (currentAvailablePosition >= amount)
  let transferState = {}
  if (success) {
    transferState = {
      transferId,
      state: transferStates.RESERVED
    }
    batchMap.set(currency, Object.assign(batchElement, {
      availablePosition: currentAvailablePosition - amount,
      positionReservedValue: reservedPosition + sumTransfersInBatch + amount,
      positionValue: batchElement.positionValue + amount,
      sumReserved: batchElement.sumReserved + amount
    }))
  } else {
    transferState = {
      transferId: message.payload.transferId,
      state: transferStates.REJECTED,
      error: ('TODO ADD ERROR 4001 to the transfer')
    }
    batchElement.messages.delete(transferId)
    batchMap.set(currency, Object.assign(batchElement, {
      positionReservedValue: reservedPosition + sumTransfersInBatch - amount
    }))
  }
  return {
    success,
    transferState,
    message
  }
}
