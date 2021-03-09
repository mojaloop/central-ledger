/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

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

 * ModusBox
 - Deon Botha <deon.botha@modusbox.com>
 --------------
 ******/

'use strict'

exports.up = async (knex) => {
  await knex.schema.hasTable('settlementModel').then(async function(tableExists) {
    if (tableExists) {
      await knex.schema.hasColumn('settlementModel', 'settlementAccountTypeId')
        .then(async (columnExists) => {
          if (!columnExists){
            await knex.schema.alterTable('settlementModel', (t) => {
              t.integer('settlementAccountTypeId').unsigned().defaultTo(null)
            })
            await knex.transaction(async (trx) => {
              try {
                await knex.select('s.settlementModelId', 's.name', 'lat.name AS latName')
                  .from('settlementModel AS s')
                  .transacting(trx)
                  .innerJoin('ledgerAccountType as lat', 's.ledgerAccountTypeId', 'lat.ledgerAccountTypeId')
                  .then(async (models) => {
                    for (const model of models) {
                      let settlementAccountName
                      if (model.latName === 'POSITION') {
                        settlementAccountName = 'SETTLEMENT'
                      } else {
                        settlementAccountName = model.latName + '_SETTLEMENT'
                      }
                      await knex('settlementModel').transacting(trx).update({ settlementAccountTypeId: knex('ledgerAccountType').select('ledgerAccountTypeId').where('name', settlementAccountName) })
                        .where('settlementModelId', model.settlementModelId)
                    }
                  })
                await trx.commit
              } catch (e) {
                await trx.rollback
              }
            })
            await knex.schema.alterTable('settlementModel', (t) => {
              t.integer('settlementAccountTypeId').alter().notNullable()
            })
          }
        })
    }
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('settlementModel',(t) => {
    t.dropColumn('settlementAccountTypeId')
  })
}
