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

 * Vijaya Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

'use strict'

const Db = require('../../lib/db')
const Logger = require('@mojaloop/central-services-logger')
const Enum = require('@mojaloop/central-services-shared').Enum
const TS = Enum.Transfers.TransferInternalState
const { rethrow } = require('@mojaloop/central-services-shared').Util

const cleanup = async () => {
  Logger.isDebugEnabled && Logger.debug('cleanup fxTransferTimeout')
  try {
    const knex = await Db.getKnex()

    const ttIdList = await Db.from('fxTransferTimeout').query(async (builder) => {
      const b = await builder
        .whereIn('tsc.transferStateId', [`${TS.RECEIVED_FULFIL}`, `${TS.COMMITTED}`, `${TS.FAILED}`, `${TS.RESERVED_TIMEOUT}`,
          `${TS.RECEIVED_REJECT}`, `${TS.EXPIRED_PREPARED}`, `${TS.EXPIRED_RESERVED}`, `${TS.ABORTED_REJECTED}`, `${TS.ABORTED_ERROR}`])
        .innerJoin(
          knex('fxTransferTimeout AS tt1')
            .select('tsc1.commitRequestId')
            .max('tsc1.fxTransferStateChangeId AS maxFxTransferStateChangeId')
            .innerJoin('fxTransferStateChange AS tsc1', 'tsc1.commitRequestId', 'tt1.commitRequestId')
            .groupBy('tsc1.commitRequestId').as('ts'), 'ts.commitRequestId', 'fxTransferTimeout.commitRequestId'
        )
        .innerJoin('fxTransferStateChange AS tsc', 'tsc.fxTransferStateChangeId', 'ts.maxFxTransferStateChangeId')
        .select('fxTransferTimeout.fxTransferTimeoutId')
      return b
    })

    await Db.from('fxTransferTimeout').query(async (builder) => {
      const b = await builder
        .whereIn('fxTransferTimeoutId', ttIdList.map(elem => elem.fxTransferTimeoutId))
        .del()
      return b
    })
    return ttIdList
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

module.exports = {
  cleanup
}
