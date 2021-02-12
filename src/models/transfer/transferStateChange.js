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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/
'use strict'

const Db = require('../../lib/db')
const Logger = require('@mojaloop/central-services-logger')

const saveTransferStateChange = async (stateChange) => {
  Logger.isDebugEnabled && Logger.debug('save transferStateChange' + stateChange.toString())
  try {
    return Db.from('transferStateChange').insert(stateChange)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}

const getByTransferId = async (id) => {
  try {
    return await Db.from('transferStateChange').query(async (builder) => {
      const result = builder
        .where({ 'transferStateChange.transferId': id })
        .select('transferStateChange.*')
        .orderBy('transferStateChangeId', 'desc')
        .first()
      return result
    })
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}

const getByTransferIdList = async (transfersIdList) => {
  try {
    return await Db.from('transferStateChange').query(async (builder) => {
      const result = builder
        .whereIn('transferStateChange.transferId', transfersIdList)
      return result
    })
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}

const getLatest = async () => {
  try {
    return await Db.from('transferStateChange').query(async (builder) => {
      return builder
        .select('transferStateChangeId')
        .orderBy('transferStateChangeId', 'desc')
        .first()
    })
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}

const truncate = async () => {
  try {
    return await Db.from('transferStateChange').truncate()
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}

module.exports = {
  saveTransferStateChange,
  getByTransferId,
  getByTransferIdList,
  getLatest,
  truncate
}
