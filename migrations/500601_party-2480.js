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
 - Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

// Notes: these changes are required for the quoting-service and are not used by central-ledger
// This implements [Central-ledger migration scripts should configure the Quote Party table to utf8 character set #2480](https://github.com/mojaloop/project/issues/2480)
// Referencing for MySQL Documentation: https://dev.mysql.com/doc/refman/5.6/en/alter-table.html#alter-table-character-set
'use strict'

const characterSet = 'utf8mb4'
const coalition = 'utf8mb4_unicode_ci'

exports.up = async (knex) => {
  console.log(`WARNING: Migration script 500601_party-2480.js is converting PARTY table to use the following character set ${characterSet} with ${coalition} collation`)
  return knex.schema.hasTable('party').then(async (exists) => {
    if (exists) {
      try {
      const result = await knex.select(knex.raw(`
        CCSA.character_set_name, CCSA.collation_name
        FROM information_schema.TABLES T,
        information_schema.COLLATION_CHARACTER_SET_APPLICABILITY CCSA 
        WHERE CCSA.collation_name = T.table_collation 
        AND T.table_name = "party";
      `))
      console.log(`WARNING: Migration script 500601_party-2480.js - take note of the current configuration if you wish to revert= ${JSON.stringify(result)}`)
      await knex.raw(`
        ALTER TABLE party CONVERT TO CHARACTER
        SET ${characterSet} COLLATE ${coalition}
      `)
      } catch (err) {
        console.log(`ERROR: Migration script 500601_party-2480.js - converting PARTY table to use the following character set ${characterSet} with ${coalition} collation has failed!`)
        console.error(err)
        throw err
      }
    }
  })
}

exports.down = (knex) => {
  console.log('WARNING: Migration script 500601_party-2480.js must manually be reversed')
}
