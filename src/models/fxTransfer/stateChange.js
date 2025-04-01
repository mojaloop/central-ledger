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

 * Infitx
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 - Kevin Leyow <kevin.leyow@infitx.com>
 - Kalin Krustev <kalin.krustev@infitx.com>
 - Steven Oderayi <steven.oderayi@infitx.com>
 - Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------

 ******/

const TransferError = require('../../models/transfer/transferError')
const Db = require('../../lib/db')
const { TABLE_NAMES } = require('../../shared/constants')
const rethrow = require('../../shared/rethrow')

const table = TABLE_NAMES.fxTransferStateChange

const getByCommitRequestId = async (id) => {
  return await Db.from(table).query(async (builder) => {
    return builder
      .where({ 'fxTransferStateChange.commitRequestId': id })
      .select('fxTransferStateChange.*')
      .orderBy('fxTransferStateChangeId', 'desc')
      .first()
  })
}

const logTransferError = async (id, errorCode, errorDescription) => {
  try {
    const stateChange = await getByCommitRequestId(id)
    return TransferError.insert(id, stateChange.fxTransferStateChangeId, errorCode, errorDescription)
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const getLatest = async () => {
  try {
    return await Db.from('fxTransferStateChange').query(async (builder) => {
      return builder
        .select('fxTransferStateChangeId')
        .orderBy('fxTransferStateChangeId', 'desc')
        .first()
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

module.exports = {
  getByCommitRequestId,
  logTransferError,
  getLatest
}
