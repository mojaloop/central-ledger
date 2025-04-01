/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/
'use strict'

const Db = require('../../lib/db')
const Logger = require('../../shared/logger').logger
const rethrow = require('../../shared/rethrow')

const saveTransferStateChange = async (stateChange) => {
  Logger.isDebugEnabled && Logger.debug('save transferStateChange' + stateChange.toString())
  try {
    return Db.from('transferStateChange').insert(stateChange)
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
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
    rethrow.rethrowDatabaseError(err)
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
    rethrow.rethrowDatabaseError(err)
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
    rethrow.rethrowDatabaseError(err)
  }
}

const truncate = async () => {
  try {
    return await Db.from('transferStateChange').truncate()
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

module.exports = {
  saveTransferStateChange,
  getByTransferId,
  getByTransferIdList,
  getLatest,
  truncate
}
