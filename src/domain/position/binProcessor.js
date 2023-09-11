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

 * INFITX
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>

 --------------
 ******/
'use strict'

// const BatchPositionModel = require('../../models/position/batch')

/**
 * @function processBins
 *
 * @async
 * @description This is the domain function to process a list bins containing position messages grouped by participant account.
 *
 * @param {array} bins - a list of account-bins to process
 * @param {object} trx - Database transaction object
 *
 * @returns {results} - Returns a list of bins with results or throws an error if failed
 */
const processBins = async (bins, trx) => {
  // TODO: Implement binProcessor
  const transferIdList = []
  iterateThroughBins(bins, (item) => {
    if (item.message.value.id) {
      transferIdList.push(item.message.value.id)
    }
  })
  // 1. Pre fetch all transferStateChanges for all the transferIds in the account-bin
  // const latestTransferStates = await TransferStateChangeModel.getLatestByTransferIdList(transferIdList)
  // 2. Pre fetch all position and settlement account balances for the account-bin and acquire lock on position
  // 3. For each account-bin in the list
  //   3.1. If non-prepare action found, log error
  //   3.2. If prepare action found
  //      3.2.1. Pre fetch NDC limit of participant
  //      3.2.2. Pre fetch settlementModelDelay
  //      3.2.3. then call processPositionPrepareBin function with:
  //          messages, positionValue, positionReservedValue, settlementPositionValue, settlementModelDelay, participantLimitValue, transferStateChanges
  //        Output: accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedTransferStateChanges
  //   3.3. Insert accumulated transferStateChanges by calling a facade function
  //   3.4. Update accumulated position value by calling a facade function
  // 4. Return results
  // {
  //   accumulatedPosition,
  //   transferStateChanges,
  //   participantPositionChanges,
  //   notifyMessages
  // }
}

/**
 * @function iterateThroughBins
 *
 * @async
 * @description Helper function to iterate though all messages in bins.
 *
 * @param {array} bins - a list of account-bins to iterate
 * @param {async function} cb - callback function to call for each item
 *
 * @returns {void} - Doesn't return anything
 */

const iterateThroughBins = async (bins, cb) => {
  for (const accountID in bins) {
    const accountBin = bins[accountID]
    for (const action in accountBin) {
      const actionBin = accountBin[action]
      for (const item of actionBin) {
        await cb(item)
      }
    }
  }
}

module.exports = {
  processBins,
  iterateThroughBins
}
