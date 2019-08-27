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
const Time = require('@mojaloop/central-services-shared').Util.Time
const Config = require('../src/lib/config')
const RUN_DATA_MIGRATIONS = Config.DB_RUN_DATA_MIGRATIONS

/**
 * This migration script is provided with no warranties! It is given as a reference
 * to help implementers, as well as used by maintainers for QA and other enabling tasks.
 * Use at your own risk!
 * 
 * Make sure you have fresh DB backup before initializing it and also set 
 * `tableNameSuffix` to match the suffix of the tables you want to migrate data from.
 * If you need to execute this script multiple times after failure or modifications,
 * please delete the corresponding record from central_ledger.migration table.
 * After migrating data to the new data structures, drop suffixed tables at your
 * consideration.
 */
const migrateData = async (knex) => {
  return knex.transaction(async trx => {
    try {
      await knex.raw('update currency set scale = \'2\' where currencyId = \'AED\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'AFA\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'AFN\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'ALL\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'AMD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'ANG\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'AOA\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'AOR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'ARS\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'AUD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'AWG\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'AZN\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'BAM\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'BBD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'BDT\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'BGN\'').transacting(trx)
      await knex.raw('update currency set scale = \'3\' where currencyId = \'BHD\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'BIF\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'BMD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'BND\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'BOB\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'BRL\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'BSD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'BTN\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'BWP\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'BYN\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'BZD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'CAD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'CDF\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'CHF\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'CLP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'CNY\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'COP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'CRC\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'CUC\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'CUP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'CVE\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'CZK\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'DJF\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'DKK\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'DOP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'DZD\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'EEK\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'EGP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'ERN\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'ETB\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'EUR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'FJD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'FKP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'GBP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'GEL\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'GGP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'GHS\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'GIP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'GMD\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'GNF\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'GTQ\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'GYD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'HKD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'HNL\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'HRK\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'HTG\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'HUF\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'IDR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'ILS\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'IMP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'INR\'').transacting(trx)
      await knex.raw('update currency set scale = \'3\' where currencyId = \'IQD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'IRR\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'ISK\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'JEP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'JMD\'').transacting(trx)
      await knex.raw('update currency set scale = \'3\' where currencyId = \'JOD\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'JPY\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'KES\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'KGS\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'KHR\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'KMF\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'KPW\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'KRW\'').transacting(trx)
      await knex.raw('update currency set scale = \'3\' where currencyId = \'KWD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'KYD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'KZT\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'LAK\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'LBP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'LKR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'LRD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'LSL\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'LTL\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'LVL\'').transacting(trx)
      await knex.raw('update currency set scale = \'3\' where currencyId = \'LYD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MAD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MDL\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MGA\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MKD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MMK\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MNT\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MOP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MRO\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MUR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MVR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MWK\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MXN\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MYR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'MZN\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'NAD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'NGN\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'NIO\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'NOK\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'NPR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'NZD\'').transacting(trx)
      await knex.raw('update currency set scale = \'3\' where currencyId = \'OMR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'PAB\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'PEN\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'PGK\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'PHP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'PKR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'PLN\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'PYG\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'QAR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'RON\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'RSD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'RUB\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'RWF\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SAR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SBD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SCR\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SDG\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SEK\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SGD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SHP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SLL\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SOS\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'SPL\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SRD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'STD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SVC\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SYP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'SZL\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'THB\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'TJS\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'TMT\'').transacting(trx)
      await knex.raw('update currency set scale = \'3\' where currencyId = \'TND\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'TOP\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'TRY\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'TTD\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'TVD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'TWD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'TZS\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'UAH\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'UGX\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'USD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'UYU\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'UZS\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'VEF\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'VND\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'VUV\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'WST\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'XAF\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'XAG\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'XAU\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'XCD\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'XDR\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'XFO\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'XFU\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'XOF\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'XPD\'').transacting(trx)
      await knex.raw('update currency set scale = \'0\' where currencyId = \'XPF\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'XPT\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'YER\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'ZAR\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'ZMK\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'ZMW\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'ZWD\'').transacting(trx)
      await knex.raw('update currency set scale = \'2\' where currencyId = \'ZWL\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'ZWN\'').transacting(trx)
      await knex.raw('update currency set scale = \'4\' where currencyId = \'ZWR\'').transacting(trx)

      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'BOV\', \'Bolivia Mvdol\', 2)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'2\' where currencyId = \'BOV\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'BYR\', \'Belarussian Ruble\', 0)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'0\' where currencyId = \'BYR\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'CHE\', \'Switzerland WIR Euro\', 2)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'2\' where currencyId = \'CHE\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'CHW\', \'Switzerland WIR Franc\', 2)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'2\' where currencyId = \'CHW\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'CLF\', \'Unidad de Fomento\', 4)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'4\' where currencyId = \'CLF\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'COU\', \'Unidad de Valor Real\', 2)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'2\' where currencyId = \'COU\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'MXV\', \'Mexican Unidad de Inversion (UDI)\', 2)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'2\' where currencyId = \'MXV\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'SSP\', \'South Sudanese Pound\', 2)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'2\' where currencyId = \'SSP\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'USN\', \'US Dollar (Next day)\', 2)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'2\' where currencyId = \'USN\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'UYI\', \'Uruguay Peso en Unidades Indexadas (URUIURUI)\', 0)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'0\' where currencyId = \'UYI\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'XSU\', \'Sucre\', 4)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'4\' where currencyId = \'XSU\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'XTS\', \'Reserved for testing purposes\', 4)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'4\' where currencyId = \'XTS\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'XUA\', \'African Development Bank (ADB) Unit of Account\', 4)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'4\' where currencyId = \'XUA\'').transacting(trx) }
      try {
        await knex.raw('insert into currency (currencyId, name, scale) values (\'XXX\', \'Assigned for transactions where no currency is involved\', 4)').transacting(trx)
      } catch (e) { await knex.raw('update currency set scale = \'4\' where currencyId = \'XXX\'').transacting(trx) }
      await trx.commit
    } catch (err) {
      await trx.rollback
      throw err
    }
  })
}

exports.up = async (knex, Promise) => {
  if (RUN_DATA_MIGRATIONS) {
    return await migrateData(knex)
  }
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('currency')
}
