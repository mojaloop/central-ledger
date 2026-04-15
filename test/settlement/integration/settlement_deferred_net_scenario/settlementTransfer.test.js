/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const logger = require('@mojaloop/central-services-logger')
const MLNumber = require('@mojaloop/ml-number')
const SettlementTransferData = require('./settlementTransferData')
const Models = require('../helpers/models')
const Config = require('../../../../src/settlement/lib/config')
const Db = require('../../../../src/settlement/lib/db')
const SettlementWindowService = require('../../../../src/settlement/domain/settlementWindow')
const SettlementService = require('../../../../src/settlement/domain/settlement')
const Enums = require('../../../../src/settlement/models/lib/enums')
const SettlementWindowStateChangeModel = require('../../../../src/settlement/models/settlementWindow/settlementWindowStateChange')
const SettlementModel = require('../../../../src/settlement/models/settlement/settlement')
const SettlementStateChangeModel = require('../../../../src/settlement/models/settlement/settlementStateChange')
const SettlementParticipantCurrencyModel = require('../../../../src/settlement/models/settlement/settlementParticipantCurrency')
const TransferStateChangeModel = require('../../../../src/models/transfer/transferStateChange')
const ParticipantPositionModel = require('../../../../src/models/position/participantPosition')
const TransferModel = require('../../../../src/models/transfer/transfer')

const Producer = require('../../../../src/settlement/lib/kafka/producer')
const StreamProducer = require('@mojaloop/central-services-stream').Util.Producer

const currency = 'EUR' // FOR THE SAKE OF PARTICIPANT FILTER ONLY TO BE ABLE TO RUN OUR TESTS
let netSettlementSenderId
let netSenderAccountId
let netSettlementRecipientId
let netRecipientAccountId
let netSettlementAmount
let netSenderSettlementTransferId
let netRecipientSettlementTransferId

// const settlementModels = require('test/settlement/integration/settlement_deferred_net_scenario/settlementTransferData')
const settlementModels = require('./settlementTransferData').settlementModels

const getEnums = async () => {
  return {
    ledgerAccountTypes: await Enums.ledgerAccountTypes(),
    ledgerEntryTypes: await Enums.ledgerEntryTypes(),
    participantLimitTypes: await Enums.participantLimitTypes(),
    settlementDelay: await Enums.settlementDelay(),
    settlementGranularity: await Enums.settlementGranularity(),
    settlementInterchange: await Enums.settlementInterchange(),
    settlementStates: await Enums.settlementStates(),
    settlementWindowStates: await Enums.settlementWindowStates(),
    transferParticipantRoleTypes: await Enums.transferParticipantRoleTypes(),
    transferStates: await Enums.transferStates()
  }
}

Test('SettlementTransfer should', async settlementTransferTest => {
  await Db.connect(Config.DATABASE)
  await SettlementTransferData.init()
  const enums = await getEnums()
  let settlementWindowId
  let settlementData

  let sandbox
  settlementTransferTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    test.end()
  })
  settlementTransferTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await settlementTransferTest.test('close the current window:', async test => {
    try {
      let params = { query: { state: enums.settlementWindowStates.OPEN } }
      const res1 = await SettlementWindowService.getByParams(params) // method to be verified
      settlementWindowId = res1[0].settlementWindowId
      test.ok(settlementWindowId > 0, '#1 retrieve the OPEN window')

      params = {
        settlementWindowId,
        state: enums.settlementWindowStates.CLOSED,
        reason: 'text',
        request: {
          headers: {
            'FSPIOP-Source': 'test',
            'FSPIOP-Destination': 'test'
          }
        }
      }
      const res2 = await SettlementWindowService.process(params, enums.settlementWindowStates)
      const res3 = await SettlementWindowService.close(params.settlementWindowId, params.reason)
      test.ok(res3, '#2 close settlement window operation success')

      const closedWindow = await SettlementWindowStateChangeModel.getBySettlementWindowId(settlementWindowId)
      const openWindow = await SettlementWindowStateChangeModel.getBySettlementWindowId(res2.settlementWindowId)
      test.equal(closedWindow.settlementWindowStateId, enums.settlementWindowStates.CLOSED, `#3 window id ${settlementWindowId} is CLOSED`)
      test.equal(openWindow.settlementWindowStateId, enums.settlementWindowStates.OPEN, `#4 window id ${res2.settlementWindowId} is OPEN`)

      for (const currency of SettlementTransferData.currencies) {
        const settlementWindowContentData = await Models.settlementWindowContent.getByParams({ settlementWindowId, currencyId: currency })
        const id = settlementWindowContentData[0].settlementWindowContentId
        test.equal(settlementWindowContentData.length, 1, `#5 window content id ${id} has been created`)
        test.equal(settlementWindowContentData[0].settlementId, null, `#6 window content id ${id} has not been assigned to a settlement yet`)

        const settlementWindowContentStateChange = await Models.settlementWindowContentStateChange.getBySettlementWindowContentId(id)
        test.equal(settlementWindowContentStateChange.settlementWindowStateId, 'CLOSED', `#7 window content id ${id} state is CLOSED`)
        test.equal(settlementWindowContentStateChange.settlementWindowContentStateChangeId, settlementWindowContentData[0].currentStateChangeId, '#8 state pointer is up-to-date')

        const settlementContentAggregationData = await Models.settlementWindowContentAggregation.getBySettlementWindowContentId(id)
        test.ok(settlementContentAggregationData.length > 0, `#9 a total of ${settlementContentAggregationData.length} content aggregation records have been generated for window content ${id}`)
        for (const sca of settlementContentAggregationData) {
          test.equal(sca.currentStateId, 'CLOSED', `#10 content aggregation id ${sca.settlementContentAggregationId} state is CLOSED`)
          test.equal(sca.settlementId, null, `#11 content aggregation id ${sca.settlementContentAggregationId} has not been assigned to a settlement yet`)
        }
      }

      test.end()
    } catch (err) {
      logger.error(`settlementTransferTest failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementTransferTest.test(`create a settlement using the ${settlementModels[2].name} Settlement Model:`, async test => {
    try {
      const params = {
        settlementModel: settlementModels[2].name,
        reason: 'reason',
        settlementWindows: [
          {
            id: settlementWindowId
          }
        ]
      }
      settlementData = await SettlementService.settlementEventTrigger(params, enums) // method to be verified
      test.ok(settlementData, '#12 settlementEventTrigger operation success')

      const sId = settlementData.id
      test.equal(settlementData.settlementWindows.length, 1, `#13 settlement id ${sId} holds one window`)
      test.ok(settlementData.settlementWindows[0].content.length > 0, '#14 settlement window has content')
      test.equal(settlementData.settlementWindows[0].content[0].state, 'PENDING_SETTLEMENT', '#15settlement window content state is PENDING_SETTLEMENT')

      const swcId = settlementData.settlementWindows[0].content[0].id
      const settlementWindowContent = await Models.settlementWindowContent.getById(swcId)
      test.equal(settlementWindowContent.settlementId, settlementData.id, `#16 window content id ${swcId} has been assigned to settlement id ${sId}`)

      const settlementWindow = await SettlementWindowStateChangeModel.getBySettlementWindowId(settlementWindowId)
      test.equal(settlementWindow.settlementWindowStateId, enums.settlementWindowStates.PENDING_SETTLEMENT, `#17 window id ${settlementWindowId} is PENDING_SETTLEMENT`)

      const settlement = await SettlementModel.getById(settlementData.id)
      test.ok(settlement, `#18 create settlement with id ${settlementData.id}`)

      const settlementState = await SettlementStateChangeModel.getBySettlementId(settlementData.id)
      test.equal(settlementState.settlementStateId, enums.settlementStates.PENDING_SETTLEMENT, '#19 settlement state is PENDING_SETTLEMENT')
      test.end()
    } catch (err) {
      logger.error(`settlementTransferTest failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementTransferTest.test('PS_TRANSFERS_RECORDED for PAYER:', async test => {
    try {
      // read and store settlement participant and account data needed in remaining tests
      let participantFilter = settlementData.participants.filter(participant => {
        return participant.accounts.find(account => {
          if (account.netSettlementAmount.currency === currency && account.netSettlementAmount.amount > 0) {
            netSenderAccountId = account.id
            netSettlementAmount = account.netSettlementAmount.amount
            return true
          } else {
            return false
          }
        })
      })
      netSettlementSenderId = participantFilter[0].id
      participantFilter = settlementData.participants.filter(participant => {
        return participant.accounts.find(account => {
          if (account.netSettlementAmount.currency === currency && account.netSettlementAmount.amount < 0) {
            netRecipientAccountId = account.id
            return true
          } else {
            return false
          }
        })
      })
      netSettlementRecipientId = participantFilter[0].id
      // data retrieved and stored into module scope variables

      const params = {
        participants: [
          {
            id: netSettlementSenderId,
            accounts: [
              {
                id: netSenderAccountId,
                reason: 'Transfers recorded for payer',
                state: enums.settlementStates.PS_TRANSFERS_RECORDED
              }
            ]
          }
        ]
      }
      const res = await SettlementService.putById(settlementData.id, params, enums) // method to be verified
      test.ok(res, '#20 settlement putById operation successful')

      const settlementParticipantCurrencyRecord = await SettlementParticipantCurrencyModel.getBySettlementAndAccount(settlementData.id, netSenderAccountId)
      test.equal(settlementParticipantCurrencyRecord.settlementStateId, enums.settlementStates.PS_TRANSFERS_RECORDED, '#21 record for payer changed to PS_TRANSFERS_RECORDED')

      netSenderSettlementTransferId = settlementParticipantCurrencyRecord.settlementTransferId
      const transferRecord = await TransferModel.getById(netSenderSettlementTransferId)
      test.ok(transferRecord, '#22 settlement transfer is created for payer')

      const transferStateChangeRecord = await TransferStateChangeModel.getByTransferId(netSenderSettlementTransferId)
      test.equal(transferStateChangeRecord.transferStateId, enums.transferStates.RECEIVED_PREPARE, '#23 settlement transfer for payer is RECEIVED_PREPARE')

      const transferParticipantRecords = await Models.getTransferParticipantsByTransferId(netSenderSettlementTransferId)
      const hubTransferParticipant = transferParticipantRecords.find(record => {
        return record.transferParticipantRoleTypeId === enums.transferParticipantRoleTypes.HUB
      })
      const payerTransferParticipant = transferParticipantRecords.find(record => {
        return record.transferParticipantRoleTypeId === enums.transferParticipantRoleTypes.DFSP_POSITION
      })
      test.ok(payerTransferParticipant.amount < 0, `#24 DR settlement transfer for SETTLEMENT_NET_SENDER is negative for payer ${payerTransferParticipant.amount}`)
      test.ok(hubTransferParticipant.amount > 0, `#25 CR settlement transfer for SETTLEMENT_NET_SENDER is positive for hub ${hubTransferParticipant.amount}`)
      test.end()
    } catch (err) {
      logger.error(`settlementTransferTest failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementTransferTest.test('PS_TRANSFERS_RECORDED for PAYEE:', async test => {
    try {
      const externalReferenceSample = 'tr0123456789'
      const params = {
        participants: [
          {
            id: netSettlementRecipientId,
            accounts: [
              {
                id: netRecipientAccountId,
                reason: 'Transfers recorded for payee',
                state: enums.settlementStates.PS_TRANSFERS_RECORDED,
                externalReference: externalReferenceSample
              }
            ]
          }
        ]
      }
      const res = await SettlementService.putById(settlementData.id, params, enums) // method to be verified
      test.ok(res, '#26 settlement putById operation successful')

      const settlementParticipantCurrencyRecord = await SettlementParticipantCurrencyModel.getBySettlementAndAccount(settlementData.id, netRecipientAccountId)
      test.equal(settlementParticipantCurrencyRecord.settlementStateId, enums.settlementStates.PS_TRANSFERS_RECORDED, '#27 record for payee changed to PS_TRANSFERS_RECORDED')
      test.equal(settlementParticipantCurrencyRecord.externalReference, externalReferenceSample, '#28 external reference is recorded')

      netRecipientSettlementTransferId = settlementParticipantCurrencyRecord.settlementTransferId
      const transferRecord = await TransferModel.getById(netRecipientSettlementTransferId)
      test.ok(transferRecord, '#29 settlement transfer is created for payee')

      const transferStateChangeRecord = await TransferStateChangeModel.getByTransferId(netRecipientSettlementTransferId)
      test.equal(transferStateChangeRecord.transferStateId, enums.transferStates.RECEIVED_PREPARE, '#30 settlement transfer for payee is RECEIVED_PREPARE')

      const transferParticipantRecords = await Models.getTransferParticipantsByTransferId(netRecipientSettlementTransferId)
      const hubTransferParticipant = transferParticipantRecords.find(record => {
        return record.transferParticipantRoleTypeId === enums.transferParticipantRoleTypes.HUB
      })
      const payeeTransferParticipant = transferParticipantRecords.find(record => {
        return record.transferParticipantRoleTypeId === enums.transferParticipantRoleTypes.DFSP_POSITION
      })
      test.ok(hubTransferParticipant.amount < 0, `#31 DR settlement transfer for SETTLEMENT_NET_RECIPIENT is negative for hub ${hubTransferParticipant.amount}`)
      test.ok(payeeTransferParticipant.amount > 0, `#32 CR settlement transfer for SETTLEMENT_NET_RECIPIENT is positive for payer ${payeeTransferParticipant.amount}`)

      const settlementState = await SettlementStateChangeModel.getBySettlementId(settlementData.id)

      /*
  not ok 320 #33 settlement state is PS_TRANSFERS_RECORDED
  ---
    operator: equal
    expected: 'PS_TRANSFERS_RECORDED'
    actual:   'PENDING_SETTLEMENT'
 */

      test.equal(settlementState.settlementStateId, enums.settlementStates.PS_TRANSFERS_RECORDED, '#33 settlement state is PS_TRANSFERS_RECORDED')

      test.end()
    } catch (err) {
      logger.error(`settlementTransferTest failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementTransferTest.test('PS_TRANSFERS_RESERVED for PAYER & PAYEE:', async test => {
    try {
      const params = {
        participants: [
          {
            id: netSettlementSenderId,
            accounts: [
              {
                id: netSenderAccountId,
                reason: 'Transfers reserved for payer & payee',
                state: enums.settlementStates.PS_TRANSFERS_RESERVED
              }
            ]
          },
          {
            id: netSettlementRecipientId,
            accounts: [
              {
                id: netRecipientAccountId,
                reason: 'Transfers reserved for payer & payee',
                state: enums.settlementStates.PS_TRANSFERS_RESERVED
              }
            ]
          }
        ]
      }
      const initialPayerPosition = (await ParticipantPositionModel.getPositionByCurrencyId(netSenderAccountId)).value
      const initialPayeePosition = (await ParticipantPositionModel.getPositionByCurrencyId(netRecipientAccountId)).value

      const res = await SettlementService.putById(settlementData.id, params, enums) // method to be verified
      test.ok(res, '#34 settlement putById operation successful')

      const payerSettlementParticipantCurrencyRecord = await SettlementParticipantCurrencyModel.getBySettlementAndAccount(settlementData.id, netSenderAccountId)
      test.equal(payerSettlementParticipantCurrencyRecord.settlementStateId, enums.settlementStates.PS_TRANSFERS_RESERVED, '#35 record for payer changed to PS_TRANSFERS_RESERVED')

      const payeeSettlementParticipantCurrencyRecord = await SettlementParticipantCurrencyModel.getBySettlementAndAccount(settlementData.id, netRecipientAccountId)
      test.equal(payeeSettlementParticipantCurrencyRecord.settlementStateId, enums.settlementStates.PS_TRANSFERS_RESERVED, '#36 record for payee changed to PS_TRANSFERS_RESERVED')

      const settlementState = await SettlementStateChangeModel.getBySettlementId(settlementData.id)
      test.equal(settlementState.settlementStateId, enums.settlementStates.PS_TRANSFERS_RESERVED, '#37 settlement state is PS_TRANSFERS_RESERVED')

      const payerTransferStateChangeRecord = await TransferStateChangeModel.getByTransferId(netSenderSettlementTransferId)
      test.equal(payerTransferStateChangeRecord.transferStateId, enums.transferStates.RESERVED, '#38 settlement transfer for payer is RESERVED')

      const payeeTransferStateChangeRecord = await TransferStateChangeModel.getByTransferId(netRecipientSettlementTransferId)
      test.equal(payeeTransferStateChangeRecord.transferStateId, enums.transferStates.RESERVED, '#39 settlement transfer for payee is RESERVED')

      const currentPayerPosition = (await ParticipantPositionModel.getPositionByCurrencyId(netSenderAccountId)).value
      test.ok(new MLNumber(currentPayerPosition).isEqualTo(initialPayerPosition), '#40 position for NET_SETTLEMENT_SENDER is not changed')

      const currentPayeePosition = (await ParticipantPositionModel.getPositionByCurrencyId(netRecipientAccountId)).value
      test.ok(new MLNumber(initialPayeePosition).add(netSettlementAmount).isEqualTo(currentPayeePosition), '#41 position for NET_SETTLEMENT_RECIPIENT is adjusted')

      test.end()
    } catch (err) {
      logger.error(`settlementTransferTest failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementTransferTest.test('PS_TRANSFERS_COMMITTED for PAYER & PAYEE:', async test => {
    try {
      const params = {
        participants: [
          {
            id: netSettlementSenderId,
            accounts: [
              {
                id: netSenderAccountId,
                reason: 'Transfers committed for payer & payee',
                state: enums.settlementStates.PS_TRANSFERS_COMMITTED
              }
            ]
          },
          {
            id: netSettlementRecipientId,
            accounts: [
              {
                id: netRecipientAccountId,
                reason: 'Transfers committed for payer & payee',
                state: enums.settlementStates.PS_TRANSFERS_COMMITTED
              }
            ]
          }
        ]
      }
      const initialPayerPosition = (await ParticipantPositionModel.getPositionByCurrencyId(netSenderAccountId)).value
      const initialPayeePosition = (await ParticipantPositionModel.getPositionByCurrencyId(netRecipientAccountId)).value

      const res = await SettlementService.putById(settlementData.id, params, enums) // method to be verified
      test.ok(res, '#42 settlement putById operation successful')

      const payerSettlementParticipantCurrencyRecord = await SettlementParticipantCurrencyModel.getBySettlementAndAccount(settlementData.id, netSenderAccountId)
      test.equal(payerSettlementParticipantCurrencyRecord.settlementStateId, enums.settlementStates.PS_TRANSFERS_COMMITTED, '#43 record for payer changed to PS_TRANSFERS_COMMITTED')

      const payeeSettlementParticipantCurrencyRecord = await SettlementParticipantCurrencyModel.getBySettlementAndAccount(settlementData.id, netRecipientAccountId)
      test.equal(payeeSettlementParticipantCurrencyRecord.settlementStateId, enums.settlementStates.PS_TRANSFERS_COMMITTED, '#44 record for payee changed to PS_TRANSFERS_COMMITTED')

      const settlementState = await SettlementStateChangeModel.getBySettlementId(settlementData.id)
      test.equal(settlementState.settlementStateId, enums.settlementStates.PS_TRANSFERS_COMMITTED, '#45 settlement state is PS_TRANSFERS_COMMITTED')

      const window = await SettlementWindowStateChangeModel.getBySettlementWindowId(settlementWindowId)
      test.equal(window.settlementWindowStateId, enums.settlementWindowStates.PENDING_SETTLEMENT, '#46 window is still PENDING_SETTLEMENT')

      const payerTransferStateChangeRecord = await TransferStateChangeModel.getByTransferId(netSenderSettlementTransferId)
      test.equal(payerTransferStateChangeRecord.transferStateId, enums.transferStates.COMMITTED, '#47 settlement transfer for payer is COMMITTED')

      const payeeTransferStateChangeRecord = await TransferStateChangeModel.getByTransferId(netRecipientSettlementTransferId)
      test.equal(payeeTransferStateChangeRecord.transferStateId, enums.transferStates.COMMITTED, '#48 settlement transfer for payee is COMMITTED')

      const currentPayerPosition = (await ParticipantPositionModel.getPositionByCurrencyId(netSenderAccountId)).value
      test.ok(new MLNumber(initialPayerPosition).subtract(netSettlementAmount).isEqualTo(currentPayerPosition), '#49 position for NET_SETTLEMENT_SENDER is adjusted')

      const currentPayeePosition = (await ParticipantPositionModel.getPositionByCurrencyId(netRecipientAccountId)).value
      test.ok(new MLNumber(currentPayeePosition).isEqualTo(initialPayeePosition), '#50 position for NET_SETTLEMENT_RECIPIENT is unchanged')

      test.end()
    } catch (err) {
      logger.error(`settlementTransferTest failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementTransferTest.test('SETTLED for PAYER', async test => {
    try {
      const params = {
        participants: [
          {
            id: netSettlementSenderId,
            accounts: [
              {
                id: netSenderAccountId,
                reason: 'Transfers settled for payer',
                state: enums.settlementStates.SETTLED
              }
            ]
          }
        ]
      }

      const res = await SettlementService.putById(settlementData.id, params, enums)
      test.ok(res, 'settlement putById operation successful')

      const payerSettlementParticipantCurrencyRecord = await SettlementParticipantCurrencyModel.getBySettlementAndAccount(settlementData.id, netSenderAccountId)
      test.equal(payerSettlementParticipantCurrencyRecord.settlementStateId, enums.settlementStates.SETTLED, '#51 record for payer changed to SETTLED')

      const settlementState = await SettlementStateChangeModel.getBySettlementId(settlementData.id)
      test.equal(settlementState.settlementStateId, enums.settlementStates.SETTLING, '#52 settlement state is SETTLING')

      const window = await SettlementWindowStateChangeModel.getBySettlementWindowId(settlementWindowId)
      test.equal(window.settlementWindowStateId, enums.settlementWindowStates.PENDING_SETTLEMENT, '#53 window is still PENDING_SETTLEMENT')

      test.end()
    } catch (err) {
      logger.error(`settlementTransferTest failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementTransferTest.test('update SETTLED for PAYER with external reference', async test => {
    try {
      const externalReferenceSample = 'tr98765432109876543210'
      const reasonSample = 'Additional reason for SETTLED account'
      const params = {
        participants: [
          {
            id: netSettlementSenderId,
            accounts: [
              {
                id: netSenderAccountId,
                reason: reasonSample,
                state: enums.settlementStates.SETTLED,
                externalReference: externalReferenceSample
              }
            ]
          }
        ]
      }

      const res = await SettlementService.putById(settlementData.id, params, enums)
      test.ok(res, '#54 settlement putById operation successful')

      const payerSettlementParticipantCurrencyRecord = await SettlementParticipantCurrencyModel.getBySettlementAndAccount(settlementData.id, netSenderAccountId)
      test.equal(payerSettlementParticipantCurrencyRecord.reason, reasonSample, '#55 Reason recorded')
      test.equal(payerSettlementParticipantCurrencyRecord.externalReference, externalReferenceSample, '#56 External reference recorded')
      test.end()
    } catch (err) {
      logger.error(`settlementTransferTest failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementTransferTest.test('SETTLED for PAYEE', async test => {
    try {
      const params = {
        participants: [
          {
            id: netSettlementRecipientId,
            accounts: [
              {
                id: netRecipientAccountId,
                reason: 'Payee: SETTLED, settlement: SETTLED',
                state: enums.settlementStates.SETTLED
              }
            ]
          }
        ]
      }

      const res = await SettlementService.putById(settlementData.id, params, enums)
      test.ok(res, '#57 settlement putById operation successful')

      const payeeSettlementParticipantCurrencyRecord = await SettlementParticipantCurrencyModel.getBySettlementAndAccount(settlementData.id, netRecipientAccountId)
      test.equal(payeeSettlementParticipantCurrencyRecord.settlementStateId, enums.settlementStates.SETTLED, '#58 record for payee changed to SETTLED')

      const settlementState = await SettlementStateChangeModel.getBySettlementId(settlementData.id)
      test.equal(settlementState.settlementStateId, enums.settlementStates.SETTLED, '#59 settlement state is SETTLED')

      const windowContentState = await Models.settlementWindowContentStateChange.getBySettlementWindowContentId(res.settlementWindows[0].content[0].id)
      test.equal(windowContentState.settlementWindowStateId, 'SETTLED', '#60 settlement window content state is SETTLED')

      const window = await SettlementWindowStateChangeModel.getBySettlementWindowId(settlementWindowId)
      test.equal(window.settlementWindowStateId, enums.settlementWindowStates.PENDING_SETTLEMENT, '#61 window is PENDING_SETTLEMENT because there is more window content to settle')

      test.end()
    } catch (err) {
      logger.error(`settlementTransferTest failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementTransferTest.test(`#62 create a settlement using the ${settlementModels[0].name} Settlement Model and settle it:`, async test => {
    try {
      const settlementStates = [enums.settlementStates.PS_TRANSFERS_RECORDED, enums.settlementStates.PS_TRANSFERS_RESERVED, enums.settlementStates.PS_TRANSFERS_COMMITTED, enums.settlementStates.SETTLED]

      let params = {
        settlementModel: settlementModels[0].name,
        reason: 'reason',
        settlementWindows: [
          {
            id: settlementWindowId
          }
        ]
      }
      settlementData = await SettlementService.settlementEventTrigger(params, enums)
      test.ok(settlementData, '#63 settlementEventTrigger operation success')

      let res
      for (const state of settlementStates) {
        params = {
          participants: [
            {
              id: settlementData.participants[0].id,
              accounts: [
                {
                  id: settlementData.participants[0].accounts[0].id,
                  reason: `Settlement to ${state} state`,
                  state
                }
              ]
            },
            {
              id: settlementData.participants[1].id,
              accounts: [
                {
                  id: settlementData.participants[1].accounts[0].id,
                  reason: `Settlement to ${state} state`,
                  state
                }
              ]
            }
          ]
        }
        res = await SettlementService.putById(settlementData.id, params, enums)
        test.ok(res, `settlement putById operation success for ${state} state`)
      }

      const settlementState = await SettlementStateChangeModel.getBySettlementId(settlementData.id)
      test.equal(settlementState.settlementStateId, enums.settlementStates.SETTLED, '#64 settlement state is SETTLED')

      const windowContentState = await Models.settlementWindowContentStateChange.getBySettlementWindowContentId(res.settlementWindows[0].content[0].id)
      test.equal(windowContentState.settlementWindowStateId, 'SETTLED', '#65 settlement window content state is SETTLED')

      test.end()
    } catch (err) {
      logger.error(`settlementTransferTest failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementTransferTest.test(`#66 create a settlement using the ${settlementModels[1].name} Settlement Model and settle it:`, async test => {
    try {
      const settlementStates = [enums.settlementStates.PS_TRANSFERS_RECORDED, enums.settlementStates.PS_TRANSFERS_RESERVED, enums.settlementStates.PS_TRANSFERS_COMMITTED, enums.settlementStates.SETTLED]

      let params = {
        settlementModel: settlementModels[1].name,
        reason: 'reason',
        settlementWindows: [
          {
            id: settlementWindowId
          }
        ]
      }
      settlementData = await SettlementService.settlementEventTrigger(params, enums)
      // Extra events get added to the settlement window annoyingly
      test.ok(settlementData, '#67 settlementEventTrigger operation success')

      let res
      for (const state of settlementStates) {
        params = {
          participants: [
            {
              id: settlementData.participants[0].id,
              accounts: [
                {
                  id: settlementData.participants[0].accounts[0].id,
                  reason: `Settlement to ${state} state`,
                  state
                }
              ]
            },
            {
              id: settlementData.participants[1].id,
              accounts: [
                {
                  id: settlementData.participants[1].accounts[0].id,
                  reason: `Settlement to ${state} state`,
                  state
                }
              ]
            }
          ]
        }
        res = await SettlementService.putById(settlementData.id, params, enums)
        test.ok(res, `settlement putById operation success for ${state} state`)
      }

      const settlementState = await SettlementStateChangeModel.getBySettlementId(settlementData.id)
      test.equal(settlementState.settlementStateId, enums.settlementStates.SETTLED, '#68 settlement state is SETTLED')

      const windowContentState = await Models.settlementWindowContentStateChange.getBySettlementWindowContentId(res.settlementWindows[0].content[0].id)
      test.equal(windowContentState.settlementWindowStateId, 'SETTLED', '#69 settlement window content state is SETTLED')

      const window = await SettlementWindowStateChangeModel.getBySettlementWindowId(res.settlementWindows[0].id)
      test.equal(window.settlementWindowStateId, enums.settlementWindowStates.SETTLED, '#70 window is SETTLED because there is no more window content to settle')

      test.end()
    } catch (err) {
      logger.error(`settlementTransferTest failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await settlementTransferTest.test('finally disconnect open handles', async test => {
    try {
      await Db.disconnect()
      await Producer.getProducer('topic-notification-event').disconnect()
      test.pass('producer to topic-notification-event disconnected')
      await StreamProducer.getProducer('topic-deferredsettlement-close').disconnect()
      test.pass('producer to topic-deferredsettlement-close disconnected')
      test.end()
    } catch (err) {
      logger.error(`settlementTransferTest failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  settlementTransferTest.end()
})
