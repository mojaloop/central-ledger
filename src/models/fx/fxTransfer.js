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

 * Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

'use strict'

const Db = require('../../lib/db')
const Logger = require('@mojaloop/central-services-logger')

const getByCommitRequestId = async (commitRequestId) => {
  Logger.isDebugEnabled && Logger.debug(`get fx transfer (commitRequestId=${commitRequestId})`)
  return Db.from('fxTransfer').findOne({ commitRequestId })
}

const getByDeterminingTransferId = async (determiningTransferId) => {
  Logger.isDebugEnabled && Logger.debug(`get fx transfer (determiningTransferId=${determiningTransferId})`)
  return Db.from('fxTransfer').findOne({ determiningTransferId })
}

const saveFxTransfer = async (record) => {
  Logger.isDebugEnabled && Logger.debug('save fx transfer' + record.toString())
  return Db.from('fxTransfer').insert(record)
}

module.exports = {
  getByCommitRequestId,
  getByDeterminingTransferId,
  saveFxTransfer
}
