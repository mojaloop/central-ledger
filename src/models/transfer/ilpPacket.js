/*
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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
******/

'use strict'

const Db = require('../../lib/db')
const Util = require('@mojaloop/central-services-shared').Util
const rethrow = require('../../shared/rethrow')

exports.saveIlpPacket = async (record) => {
  try {
    return await Db.from('ilpPacket').insert({
      transferId: record.transferId,
      value: record.value
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.getByTransferId = async (transferId) => {
  try {
    return await Db.from('ilpPacket').findOne({ transferId })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.update = async (record) => {
  const fields = {
    transferId: record.transferId,
    value: record.value
  }
  try {
    return await Db.from('ilpPacket').update({ transferId: record.transferId }, Util.omitNil(fields))
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.destroyByTransferId = async (record) => {
  try {
    return await Db.from('ilpPacket').destroy({ transferId: record.transferId })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}
