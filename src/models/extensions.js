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

'use strict'

const Db = require('../db/index')
// const Moment = require('moment')
const Util = require('../lib/util')
// const Time = require('../lib/time')

exports.saveExtension = async (extension) => {
  try {
    let ext = {
      transferId: extension.transferId,
      key: extension.key,
      value: extension.value,
      changedDate: extension.changedDate,
      changedBy: extension.changedBy
    }
    return await Db.extension.insert(ext)
  } catch (err) {
    throw new Error(err.message)
  }
}

// exports.getById = async (id) => {
//   try {
//     return await Db.ilp.findOne({ ilpId: id })
//   } catch (err) {
//     throw new Error(err.message)
//   }
// }

exports.getByTransferId = async (transferId) => {
  try {
    return await Db.extension.findOne({ transferId: transferId })
    // .innerJoin('transfer', 'transfer.transferId', 'ilp.transferId')
    // .where('expirationDate', '>', `${Time.getCurrentUTCTimeInMilliseconds()}`) // or maybe ${Moment.utc().toISOString()}
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.getByExtensionId = async (extensionId) => {
  try {
    return await Db.extension.findOne({ extensionId: extensionId })
    // .innerJoin('transfer', 'transfer.transferId', 'ilp.transferId')
    // .where('expirationDate', '>', `${Time.getCurrentUTCTimeInMilliseconds()}`) // or maybe ${Moment.utc().toISOString()}
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.update = async (extension) => {
  const fields = {
    transferId: extension.transferId,
    key: extension.key,
    value: extension.value,
    changedDate: extension.changedDate,
    changedBy: extension.changedBy
  }
  try {
    return await Db.extension.update({extensionId: extension.extensionId}, Util.filterUndefined(fields))
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.destroyByTransferId = async (extension) => {
  try {
    return await Db.extension.destroy({transferId: extension.transferId})
  } catch (err) {
    throw new Error(err.message)
  }
}
