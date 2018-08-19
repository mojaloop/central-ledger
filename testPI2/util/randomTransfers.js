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
 --------------
 ******/

'use strict'

const Uuid = require('uuid4')
const Config = require('../../src/lib/config')
const Db = require('@mojaloop/central-services-database').Db
const Enum = require('../../src/lib/enum')
const TS = Enum.TransferState

const randExpirationDate = (maxHoursDiff) => {
  let ms = Math.floor(Math.random() * maxHoursDiff * 3600 * 1000)
  if (ms > 0) {
    ms += 1 * 3600 * 1000 // make sure no future transfer expires within 1 hour
  }
  return new Date(new Date().getTime() + ms)
}

const randTransfer = (amount, currency, maxHoursDiff) => {
  const expirationDate = randExpirationDate(maxHoursDiff)
  let createdDate
  if (maxHoursDiff > 0) {
    createdDate = new Date() // all transfer that expire in the future are created at time of generation
  } else {
    createdDate = new Date(expirationDate.getTime() - ((Math.floor(Math.random() * 3600) + 3 * 60) * 1000))
  }
  return {
    transferId: Uuid(),
    amount: amount,
    currencyId: currency,
    ilpCondition: 'ilpCondition',
    expirationDate,
    createdDate
  }
}

const randTransferStateChanges = (transferId, transferCreatedDate, isExpired) => {
  let randStateNum
  if (isExpired) {
    randStateNum = Math.floor(Math.random() * 2) // TS.RECEIVED_PREPARE or TS.RESERVED
  } else {
    randStateNum = Math.ceil(Math.random() * 9) // all states
  }
  const state = Object.values(TS)[randStateNum]
  let states = [{
    transferId,
    transferStateId: TS.RECEIVED_PREPARE,
    createdDate: new Date(transferCreatedDate)
  }]
  if (randStateNum > 0) {
    states.push({
      transferId,
      transferStateId: TS.RESERVED,
      createdDate: new Date(transferCreatedDate + 10 * 1000)
    })
  }
  if (randStateNum > 1) {
    if ([TS.RECEIVED_FULFIL, TS.COMMITTED].indexOf(state) !== -1) {
      states.push({
        transferId,
        transferStateId: TS.RECEIVED_FULFIL,
        createdDate: new Date(transferCreatedDate + 70 * 1000)
      })
      if (state !== TS.RECEIVED_FULFIL) {
        states.push({
          transferId,
          transferStateId: TS.COMMITTED,
          createdDate: new Date(transferCreatedDate + 80 * 1000)
        })
      }
    } else {
      states.push({
        transferId,
        transferStateId: state,
        createdDate: new Date(transferCreatedDate + 40 * 1000)
      })
    }
  }
  return states
}

/**
 * @function generateTransfer
 *
 * not @async
 * @description Generates random transfer
 *
 * randTransfer called to generate transfer record
 * randTransferStateChange called to generate transferStateChange records
 *
 * @param {object} cfg - configuration of random data
 * @param {array} isExpired - isExpired true always produces expired transfer,
 * isExpired === false always generates non-expired transfer
 *
 * @returns {object} - Returns records to be inserted and isExpired
 */
const generateTransfer = (cfg, isExpired) => {
  const amount = cfg.amount[0] + Math.ceil(Math.random() * (cfg.amount[1] - cfg.amount[0]) * 100) / 100
  const currency = cfg.currencyList[Math.floor(Math.random() * cfg.currencyList.length)]
  let sign
  if (isExpired) {
    sign = -1
  } else {
    sign = 1
  }
  const hours = sign * (cfg.hoursDiff[0] + Math.ceil(Math.random() * (cfg.hoursDiff[1] - cfg.hoursDiff[0])))
  const transfer = randTransfer(amount, currency, hours)
  const transferStateChangeList = randTransferStateChanges(transfer.transferId, transfer.createdDate, isExpired)
  return {
    transfer,
    transferStateChangeList
  }
}

const insert = async (cfg) => {
  let isExpired
  let countExpired = 0
  let targetTransfersPerExpired = Math.floor(cfg.totalCount / cfg.expiredCount)
  let now = new Date()
  let startTime = now
  let currentTime = now
  let elapsedTime

  try {
    await Db.connect(Config.DATABASE_URI)

    for (let i = 1; i <= cfg.totalCount; i++) {
      if (countExpired === cfg.expiredCount) {
        isExpired = false
      } else if (cfg.totalCount - i <= cfg.expiredCount - countExpired) {
        isExpired = true
      } else {
        isExpired = Math.floor(Math.random() * targetTransfersPerExpired) === 0
        countExpired += isExpired ? 1 : 0
      }

      let t = generateTransfer(cfg, isExpired)
      await Db.transfer.insert(t.transfer)
      await Db.transferStateChange.insert(t.transferStateChangeList)

      if (i % cfg.debug === 0) {
        now = new Date()
        elapsedTime = Math.round((now - currentTime) / 100) / 10
        currentTime = now
        console.log(`${i} records inserted (${elapsedTime}s)`)
      }
    }
    now = new Date()
    elapsedTime = Math.round((now - startTime) / 100) / 10
    console.log(`Transfers inserted successfully! (${elapsedTime}s)`)
  } catch (err) {
    console.error(err.message)
  }
  process.exit(0)
}

const cleanAll = async () => {
  try {
    await Db.connect(Config.DATABASE_URI)
    await Db.transferStateChange.destroy()
    await Db.transfer.destroy()
    console.log(`Transfer data cleaned!`)
  } catch (err) {
    console.error(err)
  }
  process.exit(0)
}

module.exports = {
  insert,
  cleanAll
}
