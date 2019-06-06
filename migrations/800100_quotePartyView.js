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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

exports.up = function (knex, Promise) {
  return knex.raw(`
    CREATE OR REPLACE VIEW quotePartyView AS
    SELECT
        qp.quoteId AS quoteId,
        qp.quotePartyId AS quotePartyId,
        pt.name AS partyType,
        pit.name AS identifierType,
        qp.partyIdentifierValue,
        spit.name AS partySubIdOrType,
        qp.fspId AS fspId,
        qp.merchantClassificationCode AS merchantClassificationCode,
        qp.partyName AS partyName,
        p.firstName AS firstName,
        p.lastName AS lastName,
        p.middleName AS middleName,
        p.dateOfBirth AS dateOfBirth,
        gc.longitude,
        gc.latitude
    FROM
        quoteParty qp
        INNER JOIN partyType pt ON pt.partyTypeId = qp.partyTypeId
        INNER JOIN partyIdentifierType pit ON pit.partyIdentifierTypeId = qp.partyIdentifierTypeId
        LEFT JOIN party p ON p.quotePartyId = qp.quotePartyId
        LEFT JOIN partyIdentifierType spit ON spit.partyIdentifierTypeId = qp.partySubIdOrTypeId
        LEFT JOIN geoCode gc ON gc.quotePartyId = qp.quotePartyId
  `)
}

module.exports.down = async function(knex) {
  return knex.raw('DROP VIEW quotePartyView')
}
