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
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Logger = require('@mojaloop/central-services-logger')
const SettlementModelRulesEngine = require('../../../../src/models/rules/settlement-model-rules-engine')

Test('obtainSettlementModelFromTest', async (obtainSettlementModelFromTest) => {

  const ledgerAccountTypes = {
    POSITION: 1,
    SETTLEMENT: 2,
    HUB_RECONCILIATION: 3,
    HUB_MULTILATERAL_SETTLEMENT: 4,
    INTERCHANGE_FEE: 5,
    INTERCHANGE_FEE_SETTLEMENT: 6,
    POSITION_REMITTANCE: 7,
    SETTLEMENT_REMITTANCE: 8
  }

  const transactionObject = {
    transactionId: '79d034ea-1cc1-40c0-a77d-9fbf8f5e0c5d',
    quoteId: '326b2586-9817-4857-a438-8042cc5598bf',
    payee: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '27713803912',
          fspId: 'payeefsp'
        }
    },
    payer: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '44123456789',
          fspId: 'testingtoolkitdfsp'
        },
        personalInfo: {
          complexName: {
            firstName: 'Firstname-Test',
            lastName: 'Lastname-Test'
          },
          dateOfBirth: '1984-01-01'
        }
    },
    amount: {
        amount: '100',
        currency: 'USD'
    },
    transactionType: {
        scenario: 'TRANSFER',
        subScenario: 'REMITTANCE',
        initiator: 'PAYER',
        initiatorType: 'CONSUMER'
    },
    note: ''
  }

  const settlementModels = [
    {
        name: 'DEFERREDNET',
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2,
        requireLiquidityCheck: true,
        ledgerAccountTypeId: 1,
        autoPositionReset: true,
        settlementAccountTypeId: 2
    },
    {
        name: 'DEFERREDNET_REMITTANCE',
        settlementGranularityId: 2,
        settlementInterchangeId: 2,
        settlementDelayId: 2,
        requireLiquidityCheck: true,
        ledgerAccountTypeId: 7,
        autoPositionReset: true,
        settlementAccountTypeId: 8
    }
  ]

  await obtainSettlementModelFromTest.test('should select default settlement model', async (assert) => {
    try {
      const engine = new SettlementModelRulesEngine()
      const result = await engine.obtainSettlementModelFrom(transactionObject, settlementModels, ledgerAccountTypes)
      assert.assert(result.hasOwnProperty('name'), true, 'result should contain field name')
      assert.assert(result.hasOwnProperty('ledgerAccountTypeId'), true, 'result should contain field ledgerAccountTypeId')
      assert.assert(result.hasOwnProperty('settlementAccountTypeId'), true, 'result should contain field settlementAccountTypeId')
      assert.assert(result.name, 'DEFERREDNET', 'name should be DEFERREDNET')
      assert.end()
    } catch (err) {
      Logger.error(`obtainSettlementModelFrom failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  // await participantPositionTest.test('insert participant position should throw an error', async (assert) => {
  //   try {
  //     Db.participantPosition.insert.withArgs(participantPosition1).throws(new Error('message'))
  //     await Model.insert(participantPosition1)
  //     assert.fail('Error not thrown!')
  //     assert.end()
  //   } catch (err) {
  //     Logger.error(`insert participant position failed with error - ${err}`)
  //     assert.assert(err instanceof Error, 'instance of Error')
  //     assert.pass('Error thrown')
  //     assert.end()
  //   }
  // })

  // await participantPositionTest.test('update participant position', async (assert) => {
  //   try {
  //     Db.participantPosition.update.returns(1)
  //     const result = await Model.update(participantPosition1)
  //     assert.equal(result, 1, `returns ${result}`)
  //     assert.end()
  //   } catch (err) {
  //     Logger.error(`update participant position failed with error - ${err}`)
  //     assert.fail()
  //     assert.end()
  //   }
  // })

  // await participantPositionTest.test('update participant position should throw an error', async (assert) => {
  //   try {
  //     Db.participantPosition.update.throws(new Error('message'))
  //     await Model.update(participantPosition1)
  //     assert.fail('Error not thrown!')
  //     assert.end()
  //   } catch (err) {
  //     Logger.error(`update participant position failed with error - ${err}`)
  //     assert.assert(err instanceof Error, 'instance of Error')
  //     assert.pass('Error thrown')
  //     assert.end()
  //   }
  // })

  // await participantPositionTest.test('getPositionByCurrencyId participant position', async (assert) => {
  //   try {
  //     Db.participantPosition.findOne.withArgs({ participantCurrencyId: participantPosition1.participantCurrencyId }).returns(1)
  //     const result = await Model.getPositionByCurrencyId(participantPosition1.participantCurrencyId)
  //     assert.equal(result, 1, `returns ${result}`)
  //     assert.end()
  //   } catch (err) {
  //     Logger.error(`getPositionByCurrencyId participant position failed with error - ${err}`)
  //     assert.fail()
  //     assert.end()
  //   }
  // })

  // await participantPositionTest.test('getPositionByCurrencyId participant position should throw an error', async (assert) => {
  //   try {
  //     Db.participantPosition.findOne.withArgs({ participantCurrencyId: participantPosition1.participantCurrencyId }).throws(new Error('message'))
  //     await Model.getPositionByCurrencyId(participantPosition1.participantCurrencyId)
  //     assert.fail('Error not thrown!')
  //     assert.end()
  //   } catch (err) {
  //     Logger.error(`getPositionByCurrencyId participant position failed with error - ${err}`)
  //     assert.assert(err instanceof Error, 'instance of Error')
  //     assert.pass('Error thrown')
  //     assert.end()
  //   }
  // })

  obtainSettlementModelFromTest.end()
})
