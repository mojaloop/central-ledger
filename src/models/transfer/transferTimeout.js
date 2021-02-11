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
const Logger = require('@mojaloop/central-services-logger')
const Enum = require('@mojaloop/central-services-shared').Enum
const TS = Enum.Transfers.TransferInternalState

const cleanup = async () => {
  Logger.isDebugEnabled && Logger.debug('cleanup transferTimeout')
  try {
    const knex = await Db.getKnex()

    const ttIdList = await Db.from('transferTimeout').query(async (builder) => {
      const b = await builder
        .whereIn('tsc.transferStateId', [`${TS.RECEIVED_FULFIL}`, `${TS.COMMITTED}`, `${TS.FAILED}`, `${TS.RESERVED_TIMEOUT}`,
          `${TS.RECEIVED_REJECT}`, `${TS.EXPIRED_PREPARED}`, `${TS.EXPIRED_RESERVED}`, `${TS.ABORTED_REJECTED}`])
        .innerJoin(
          knex('transferTimeout AS tt1')
            .select('tsc1.transferId')
            .max('tsc1.transferStateChangeId AS maxTransferStateChangeId')
            .innerJoin('transferStateChange AS tsc1', 'tsc1.transferId', 'tt1.transferId')
            .groupBy('tsc1.transferId').as('ts'), 'ts.transferId', 'transferTimeout.transferId'
        )
        .innerJoin('transferStateChange AS tsc', 'tsc.transferStateChangeId', 'ts.maxTransferStateChangeId')
        .select('transferTimeout.transferTimeoutId')
      return b
    })

    await Db.from('transferTimeout').query(async (builder) => {
      const b = await builder
        .whereIn('transferTimeout.transferTimeoutId', ttIdList.map(elem => elem.transferTimeoutId))
        .del()
      return b
    })
    return ttIdList
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}

module.exports = {
  cleanup
}
