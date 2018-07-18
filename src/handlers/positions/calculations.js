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
const transferStateModel = require('../../models/transfer/transferStateChange')
const transferState = require('../../lib/enum').TransferState

/**
 * @module src/handlers/positions/calculations
 */

/**
* @param messages
*/

const calculateSumInBatch = async (messages) => {
  let currenciesMap = new Map()
  for (let message of messages) {
    const { amount, currency } = message.payload.amount
    if (currenciesMap.has(currency)) {
      let currentCurrency = currenciesMap.get(currency)
      currenciesMap.set(currency, {
        // messages: currentCurrency.messages.push(message),
        sumTransfersInBatch: currentCurrency.sumTransfersInBatch + amount
      })
    } else {
      currenciesMap.set(currency, {
        // messages: [message],
        sumTransfersInBatch: amount
      })
    }
    return (messages, currenciesMap)
  }
}

/**
* @param messages
* @param sumTransfersInBatch
*/

const calculateSingleMessage = async ({ message, sumTransfersInBatch }) => {
  let sumReserved = 0
  const { currency, amount } = message.payload.amount
  let participant = await participantFacade.getByNameAndCurrency(message.from, currency)
  let { currentPosition, reservedPosition } = await positionFacade.updateParticipantPositionTransaction(participant.participantCurrencyId, sumTransfersInBatch)
  let latestPosition = amount + currentPosition + reservedPosition
  const heldPosition = effectivePosition + (sumTransfersInBatch || amount)
  let effectivePosition = currentPosition + reservedPosition
  const participantPosition = await positionFacade.getParticipantPositionByParticipantIdAndCurrencyId(participant.participantId, currency) // TODO get participant position for currency from facade getParticipantPositionByParticipantIdAndCurrencyId
  let availablePosition = participantPosition.netDebitCap - effectivePosition
  if (availablePosition >= amount) {
    let preparedTransfer = {
      amount,
      state: transferState.RESERVED
    }
    availablePosition -= preparedTransfer.amount
    sumReserved += preparedTransfer.amount
  } else {
    throw new Error('TODO ADD ERROR 4001')
  }


}

const validateState = async (message) => {
  try {
    let currentTransferState = await transferStateModel.getByTransferId(message.id)
    if (currentTransferState === transferState.RECEIVED_PREPARE) {
      return true
    } else {
      throw new Error('TODO ADD ERROR 2001')
    }
  } catch (e) {
    throw new Error('TODO ADD ERROR 2003')
  }
}

module.exports.calculatePreparePosition = async (message) => {
  if (message.payload && Array.isArray(message.payload)) {
    let { messages, currenciesMap } = calculateSumInBatch(message)
    for (let message of messages) {
      let sumTransfersInBatch = currenciesMap.get(message.payload.amount.currency).sumTransfersInBatch
      let position = await calculateSingleMessage({ message, sumTransfersInBatch })
    }
  } else {
    let currenciesMap = new Map([message.payload.amount.currency], [{
      message,
      sumTransfersInBatch: 0
    }])

  }
}
