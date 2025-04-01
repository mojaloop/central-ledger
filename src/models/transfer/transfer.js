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
 --------------
 ******/

'use strict'

const Db = require('../../lib/db')
const Logger = require('../../shared/logger').logger
const rethrow = require('../../shared/rethrow')

const getById = async (transferId) => {
  try {
    return await Db.from('transfer').findOne({ transferId })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const saveTransfer = async (record) => {
  Logger.isDebugEnabled && Logger.debug('save transfer' + record.toString())
  try {
    return Db.from('transfer').insert(record)
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const destroyById = async (id) => {
  try {
    await Db.from('transfer').destroy({ transferId: id })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const truncateTransfer = async () => {
  try {
    return await Db.from('transfer').truncate()
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

module.exports = {
  getById,
  saveTransfer,
  destroyById,
  truncateTransfer
}
