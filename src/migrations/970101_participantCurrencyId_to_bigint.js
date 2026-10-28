/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
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

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------
 **********/

/**
 * To prepare for the LedgerTigerBeetle integration, we need to reduce the non-determinism in the
 * system so that we can build 2 identical implementations of Ledger.
 * 
 * One source of non-determinism is the auto incrementing ids that have been used until now. The new 
 * implementations of ledger will no longer use auto-incrementing ids, but instead random bigints
 * provided by the application.
 */
exports.up = async (knex) => {
  const statements = [
    `ALTER TABLE participantPosition DROP FOREIGN KEY participantposition_participantcurrencyid_foreign`,
    `ALTER TABLE participantLimit DROP FOREIGN KEY participantlimit_participantcurrencyid_foreign`,
    `ALTER TABLE settlementTransferParticipant DROP FOREIGN KEY settlementtransferparticipant_participantcurrencyid_foreign`,
    `ALTER TABLE participantPositionChange DROP FOREIGN KEY participantpositionchange_participantcurrencyid_foreign`,
    `ALTER TABLE settlementParticipantCurrency DROP FOREIGN KEY settlementparticipantcurrency_participantcurrencyid_foreign`,
    `ALTER TABLE settlementContentAggregation DROP FOREIGN KEY settlementcontentaggregation_participantcurrencyid_foreign`,
    `ALTER TABLE transferParticipant DROP FOREIGN KEY transferparticipant_participantcurrencyid_foreign`,
    `ALTER TABLE fxTransferParticipant DROP FOREIGN KEY fxtransferparticipant_participantcurrencyid_foreign`,
    `ALTER TABLE participantCurrency MODIFY participantCurrencyId BIGINT UNSIGNED NOT NULL`,
    `ALTER TABLE participantPosition MODIFY participantCurrencyId BIGINT UNSIGNED NOT NULL`,
    `ALTER TABLE participantLimit MODIFY participantCurrencyId BIGINT UNSIGNED NOT NULL`,
    `ALTER TABLE settlementTransferParticipant MODIFY participantCurrencyId BIGINT UNSIGNED NOT NULL`,
    `ALTER TABLE participantPositionChange MODIFY participantCurrencyId BIGINT UNSIGNED NOT NULL`,
    `ALTER TABLE settlementParticipantCurrency MODIFY participantCurrencyId BIGINT UNSIGNED NOT NULL`,
    `ALTER TABLE settlementContentAggregation MODIFY participantCurrencyId BIGINT UNSIGNED NOT NULL`,
    `ALTER TABLE transferParticipant MODIFY participantCurrencyId BIGINT UNSIGNED NOT NULL`,
    `ALTER TABLE fxTransferParticipant MODIFY participantCurrencyId BIGINT UNSIGNED NOT NULL`,
    `ALTER TABLE participantPosition ADD CONSTRAINT participantposition_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE participantLimit ADD CONSTRAINT participantlimit_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE settlementTransferParticipant ADD CONSTRAINT settlementtransferparticipant_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE participantPositionChange ADD CONSTRAINT participantpositionchange_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE settlementParticipantCurrency ADD CONSTRAINT settlementparticipantcurrency_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE settlementContentAggregation ADD CONSTRAINT settlementcontentaggregation_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE transferParticipant ADD CONSTRAINT transferparticipant_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE fxTransferParticipant ADD CONSTRAINT fxtransferparticipant_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
  ]

  await knex.transaction(async trx => {
    for (const statement of statements) {
      await trx.raw(statement)
    }
  })
}

exports.down = async (knex) => {
  const statements = [
    `ALTER TABLE participantPosition DROP FOREIGN KEY participantposition_participantcurrencyid_foreign`,
    `ALTER TABLE participantLimit DROP FOREIGN KEY participantlimit_participantcurrencyid_foreign`,
    `ALTER TABLE settlementTransferParticipant DROP FOREIGN KEY settlementtransferparticipant_participantcurrencyid_foreign`,
    `ALTER TABLE participantPositionChange DROP FOREIGN KEY participantpositionchange_participantcurrencyid_foreign`,
    `ALTER TABLE settlementParticipantCurrency DROP FOREIGN KEY settlementparticipantcurrency_participantcurrencyid_foreign`,
    `ALTER TABLE settlementContentAggregation DROP FOREIGN KEY settlementcontentaggregation_participantcurrencyid_foreign`,
    `ALTER TABLE transferParticipant DROP FOREIGN KEY transferparticipant_participantcurrencyid_foreign`,
    `ALTER TABLE fxTransferParticipant DROP FOREIGN KEY fxtransferparticipant_participantcurrencyid_foreign`,
    `ALTER TABLE participantCurrency MODIFY participantCurrencyId INT UNSIGNED NOT NULL AUTO_INCREMENT`,
    `ALTER TABLE participantPosition MODIFY participantCurrencyId INT UNSIGNED NOT NULL`,
    `ALTER TABLE participantLimit MODIFY participantCurrencyId INT UNSIGNED NOT NULL`,
    `ALTER TABLE settlementTransferParticipant MODIFY participantCurrencyId INT UNSIGNED NOT NULL`,
    `ALTER TABLE participantPositionChange MODIFY participantCurrencyId INT UNSIGNED NOT NULL`,
    `ALTER TABLE settlementParticipantCurrency MODIFY participantCurrencyId INT UNSIGNED NOT NULL`,
    `ALTER TABLE settlementContentAggregation MODIFY participantCurrencyId INT UNSIGNED NOT NULL`,
    `ALTER TABLE transferParticipant MODIFY participantCurrencyId INT UNSIGNED NOT NULL`,
    `ALTER TABLE fxTransferParticipant MODIFY participantCurrencyId INT UNSIGNED NOT NULL`,
    `ALTER TABLE participantPosition ADD CONSTRAINT participantposition_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE participantLimit ADD CONSTRAINT participantlimit_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE settlementTransferParticipant ADD CONSTRAINT settlementtransferparticipant_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE participantPositionChange ADD CONSTRAINT participantpositionchange_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE settlementParticipantCurrency ADD CONSTRAINT settlementparticipantcurrency_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE settlementContentAggregation ADD CONSTRAINT settlementcontentaggregation_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE transferParticipant ADD CONSTRAINT transferparticipant_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
    `ALTER TABLE fxTransferParticipant ADD CONSTRAINT fxtransferparticipant_participantcurrencyid_foreign FOREIGN KEY (participantCurrencyId) REFERENCES participantCurrency (participantCurrencyId) ON DELETE RESTRICT ON UPDATE RESTRICT`,
  ]

  await knex.transaction(async trx => {
    for (const statement of statements) {
      await trx.raw(statement)
    }
  })
}
