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

const Db = require('../../lib/db')
const Time = require('@mojaloop/central-services-shared').Util.Time
const LibUtil = require('@mojaloop/central-services-shared').Util

exports.create = async (bulkTransferAssociation) => {
  try {
    return Db.from('bulkTransferAssociation').insert(bulkTransferAssociation)
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.update = async (transferId, bulkTransferId, bulkTransferAssociation) => {
  try {
    const record = LibUtil.omitNil({
      bulkProcessingStateId: bulkTransferAssociation.bulkProcessingStateId,
      lastProcessedDate: bulkTransferAssociation.lastProcessedDate || Time.getUTCString(new Date()),
      errorCode: bulkTransferAssociation.errorCode,
      errorDescription: bulkTransferAssociation.errorDescription
    })
    return Db.from('bulkTransferAssociation').update({ transferId, bulkTransferId }, record)
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.exists = async (bulkTransferId, bulkProcessingStateId) => {
  try {
    return Db.from('bulkTransferAssociation').findOne({
      bulkTransferId, bulkProcessingStateId
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.count = async (bulkTransferId, bulkProcessingStateId) => {
  try {
    const knex = await Db.getKnex()
    const result = await knex('bulkTransferAssociation').count({ count: '*' })
      .where({ bulkTransferId, bulkProcessingStateId })
      .first()
    return result.count
  } catch (err) {
    throw new Error(err.message)
  }
}
