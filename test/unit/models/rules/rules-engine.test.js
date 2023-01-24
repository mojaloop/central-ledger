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

 * Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 Sridevi Miriyala <sridevi.miriyala@infitx.com>
 --------------
 ******/

"use strict";

const Test = require("tapes")(require("tape"));
const Logger = require("@mojaloop/central-services-logger");
const remittanceRules = require("../../../data/rules-settlement-model-remittance.json");
const RulesEngine = require("../../../../src/models/rules/rules-engine");

Test("rulesEngineTest", async (rulesEngineTest) => {
  await rulesEngineTest.test("loadRules should return rules", async (t) => {
    try {
      const rulesEngine = new RulesEngine();
      rulesEngine.loadRules(remittanceRules);
      t.equal(rulesEngine.engine.rules.length, 4, "checking number of rules");
      t.end();
    } catch (err) {
      Logger.error(`failed with error - ${err}`);
      t.fail();
      t.end();
    }
  });

  await rulesEngineTest.test("evaluate should return events", async (t) => {
    try {
      const facts = {
        transaction: {
          transactionId: "79d034ea-1cc1-40c0-a77d-9fbf8f5e0c5d",
          quoteId: "326b2586-9817-4857-a438-8042cc5598bf",
          payee: {
            partyIdInfo: {
              partyIdType: "MSISDN",
              partyIdentifier: "27713803912",
              fspId: "payeefsp",
            },
          },
          payer: {
            partyIdInfo: {
              partyIdType: "MSISDN",
              partyIdentifier: "44123456789",
              fspId: "testingtoolkitdfsp",
            },
            personalInfo: {
              complexName: {
                firstName: "Firstname-Test",
                lastName: "Lastname-Test",
              },
              dateOfBirth: "1984-01-01",
            },
          },
          amount: {
            amount: "100",
            currency: "USD",
          },
          transactionType: {
            scenario: "TRANSFER",
            subScenario: "REMITTANCE",
            initiator: "PAYER",
            initiatorType: "CONSUMER",
          },
          note: "",
        },
        settlementModels: [
          {
            name: "DEFERREDNET",
            settlementGranularityId: 2,
            settlementInterchangeId: 2,
            settlementDelayId: 2,
            requireLiquidityCheck: true,
            ledgerAccountTypeId: 1,
            autoPositionReset: true,
            settlementAccountTypeId: 2,
          },
          {
            name: "DEFERREDNET_REMITTANCE",
            settlementGranularityId: 2,
            settlementInterchangeId: 2,
            settlementDelayId: 2,
            requireLiquidityCheck: true,
            ledgerAccountTypeId: 7,
            autoPositionReset: true,
            settlementAccountTypeId: 8,
          },
        ],
      };
      const rulesEngine = new RulesEngine();
      rulesEngine.loadRules(remittanceRules);
      const events = await rulesEngine.evaluate(facts);
      console.log('events: ',events);
      t.equal(events.length, 2, "checking number of events");
      t.end();
    } catch (err) {
      Logger.error(`failed with error - ${err}`);
      t.fail();
      t.end();
    }
  });

  rulesEngineTest.end();
});
