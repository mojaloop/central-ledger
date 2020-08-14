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

 * ModusBox
 - Deon Botha <deon.botha@@modusbox.com>
 --------------
 ******/

'use strict'

/* transferParticipantStatechange has been deprecated */
exports.up = async (knex) => {
  return knex.schema.dropTableIfExists('transferParticipantStateChange')
}

exports.down = async function(knex, Promise) {
  return await knex.schema.hasTable('transferParticipantStateChange').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('transferParticipantStateChange', (t) => {
        t.bigIncrements('transferParticipantStateChangeId').primary().notNullable()
        t.bigInteger('transferParticipantId').notNullable().unsigned()
        t.foreign('transferParticipantId','tt_transferParticipantId_fk').references('transferParticipantId').inTable('transferParticipant')
        t.string('settlementWindowStateId', 50)
        t.foreign('settlementWindowStateId').references('settlementWindowStateId').inTable('settlementWindowState')
        t.string('reason', 512).defaultTo(null).nullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}
