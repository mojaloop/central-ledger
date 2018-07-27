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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const Model = require('../../../../src/models/transfer/facade')
const transferExtensionModel = require('../../../../src/models/transfer/transferExtension')
const Enum = require('../../../../src/lib/enum')
const Proxyquire = require('proxyquire')

Test('Transfer facade', async (transferFacadeTest) => {
  let sandbox
  let clock
  let now = new Date()

  const transferExtensions = [{key: 'key1', value: 'value1'}, {key: 'key2', value: 'value2'}]

  transferFacadeTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.transfer = {
      insert: sandbox.stub(),
      find: sandbox.stub(),
      update: sandbox.stub(),
      truncate: sandbox.stub(),
      query: sandbox.stub(),
      destroy: sandbox.stub()
    }
    Db.transferParticipant = {
      query: sandbox.stub()
    }
    clock = Sinon.useFakeTimers(now.getTime())
    t.end()
  })

  transferFacadeTest.afterEach(t => {
    sandbox.restore()
    clock.restore()
    t.end()
  })

  await transferFacadeTest.test('getById should return transfer by id', async (test) => {
    try {
      const transferId1 = 't1'
      const transferId2 = 't2'
      const transfers = [{transferId: transferId1, extensionList: transferExtensions}, {transferId: transferId2}]

      let builderStub = sandbox.stub()
      let whereRawPc1 = sandbox.stub()
      let whereRawPc2 = sandbox.stub()
      let payerTransferStub = sandbox.stub()
      let payerRoleTypeStub = sandbox.stub()
      let payerCurrencyStub = sandbox.stub()
      let payerParticipantStub = sandbox.stub()
      let payeeTransferStub = sandbox.stub()
      let payeeRoleTypeStub = sandbox.stub()
      let payeeCurrencyStub = sandbox.stub()
      let payeeParticipantStub = sandbox.stub()
      let ilpPacketStub = sandbox.stub()
      let stateChangeStub = sandbox.stub()
      let transferFulfilmentStub = sandbox.stub()

      let selectStub = sandbox.stub()
      let orderByStub = sandbox.stub()
      let firstStub = sandbox.stub()

      builderStub.where = sandbox.stub()

      Db.transfer.query.callsArgWith(0, builderStub)
      Db.transfer.query.returns(transfers[0])

      builderStub.where.returns({
        whereRaw: whereRawPc1.returns({
          whereRaw: whereRawPc2.returns({
            innerJoin: payerTransferStub.returns({
              innerJoin: payerRoleTypeStub.returns({
                innerJoin: payerCurrencyStub.returns({
                  innerJoin: payerParticipantStub.returns({
                    innerJoin: payeeTransferStub.returns({
                      innerJoin: payeeRoleTypeStub.returns({
                        innerJoin: payeeCurrencyStub.returns({
                          innerJoin: payeeParticipantStub.returns({
                            innerJoin: ilpPacketStub.returns({
                              leftJoin: stateChangeStub.returns({
                                leftJoin: transferFulfilmentStub.returns({
                                  select: selectStub.returns({
                                    orderBy: orderByStub.returns({
                                      first: firstStub.returns(transfers)
                                    })
                                  })
                                })
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })

      sandbox.stub(transferExtensionModel, 'getByTransferId')
      transferExtensionModel.getByTransferId.returns(transferExtensions)

      let found = await Model.getById(transferId1)
      test.equal(found, transfers[0])
      test.ok(builderStub.where.withArgs({
        'transfer.transferId': transferId1,
        'tprt1.name': 'PAYER_DFSP',
        'tprt2.name': 'PAYEE_DFSP'
      }).calledOnce)
      test.ok(whereRawPc1.withArgs('pc1.currencyId = transfer.currencyId').calledOnce)
      test.ok(whereRawPc2.withArgs('pc2.currencyId = transfer.currencyId').calledOnce)
      test.ok(payerTransferStub.withArgs('transferParticipant AS tp1', 'tp1.transferId', 'transfer.transferId').calledOnce)
      test.ok(payerRoleTypeStub.withArgs('transferParticipantRoleType AS tprt1', 'tprt1.transferParticipantRoleTypeId', 'tp1.transferParticipantRoleTypeId').calledOnce)
      test.ok(payerCurrencyStub.withArgs('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId').calledOnce)
      test.ok(payerParticipantStub.withArgs('participant AS da', 'da.participantId', 'pc1.participantId').calledOnce)
      test.ok(payeeTransferStub.withArgs('transferParticipant AS tp2', 'tp2.transferId', 'transfer.transferId').calledOnce)
      test.ok(payeeRoleTypeStub.withArgs('transferParticipantRoleType AS tprt2', 'tprt2.transferParticipantRoleTypeId', 'tp2.transferParticipantRoleTypeId').calledOnce)
      test.ok(payeeCurrencyStub.withArgs('participantCurrency AS pc2', 'pc2.participantCurrencyId', 'tp2.participantCurrencyId').calledOnce)
      test.ok(payeeParticipantStub.withArgs('participant AS ca', 'ca.participantId', 'pc2.participantId').calledOnce)
      test.ok(ilpPacketStub.withArgs('ilpPacket AS ilpp', 'ilpp.transferId', 'transfer.transferId').calledOnce)
      test.ok(stateChangeStub.withArgs('transferStateChange AS tsc', 'tsc.transferId', 'transfer.transferId').calledOnce)
      test.ok(transferFulfilmentStub.withArgs('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId').calledOnce)
      test.ok(selectStub.withArgs(
        'transfer.*',
        'transfer.currencyId AS currency',
        'pc1.participantCurrencyId AS payerParticipantCurrencyId',
        'tp1.amount AS payerAmount',
        'da.participantId AS payerParticipantId',
        'da.name AS payerFsp',
        'pc2.participantCurrencyId AS payeeParticipantCurrencyId',
        'tp2.amount AS payeeAmount',
        'ca.participantId AS payeeParticipantId',
        'ca.name AS payeeFsp',
        'tsc.transferStateChangeId',
        'tsc.transferStateId AS transferState',
        'tsc.reason AS reason',
        'tsc.createdDate AS completedTimestamp',
        'ilpp.value AS ilpPacket',
        'transfer.ilpCondition AS condition',
        'tf.ilpFulfilment AS fulfilment'
      ).calledOnce)
      test.ok(orderByStub.withArgs('tsc.transferStateChangeId', 'desc').calledOnce)
      test.ok(firstStub.withArgs().calledOnce)
      test.end()
    } catch (err) {
      Logger.error(`getById failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferFacadeTest.test('getById should find zero records', async (test) => {
    try {
      const transferId1 = 't1'
      let builderStub = sandbox.stub()
      Db.transfer.query.callsArgWith(0, builderStub)
      builderStub.where = sandbox.stub()
      builderStub.where.returns({
        whereRaw: sandbox.stub().returns({
          whereRaw: sandbox.stub().returns({
            innerJoin: sandbox.stub().returns({
              innerJoin: sandbox.stub().returns({
                innerJoin: sandbox.stub().returns({
                  innerJoin: sandbox.stub().returns({
                    innerJoin: sandbox.stub().returns({
                      innerJoin: sandbox.stub().returns({
                        innerJoin: sandbox.stub().returns({
                          innerJoin: sandbox.stub().returns({
                            innerJoin: sandbox.stub().returns({
                              leftJoin: sandbox.stub().returns({
                                leftJoin: sandbox.stub().returns({
                                  select: sandbox.stub().returns({
                                    orderBy: sandbox.stub().returns({
                                      first: sandbox.stub().returns(null)
                                    }) }) }) }) }) }) }) }) }) }) }) }) }) }) }) })
      let found = await Model.getById(transferId1)
      test.equal(found, null, 'no transfers were found')
      test.end()
    } catch (err) {
      Logger.error(`getById failed with error - ${err}`)
      test.fail('Error thrown')
      test.end()
    }
  })

  await transferFacadeTest.test('getById should throw an error', async (test) => {
    try {
      const transferId1 = 't1'
      Db.transfer.query.throws(new Error())
      await Model.getById(transferId1)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getById failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await transferFacadeTest.test('getAll should return all transfers', async (test) => {
    try {
      const transferId1 = 't1'
      const transferId2 = 't2'
      const transfers = [{transferId: transferId1, extensionList: transferExtensions}, {transferId: transferId2}]

      let builderStub = sandbox.stub()
      let whereRawPc1 = sandbox.stub()
      let whereRawPc2 = sandbox.stub()
      let payerTransferStub = sandbox.stub()
      let payerRoleTypeStub = sandbox.stub()
      let payerCurrencyStub = sandbox.stub()
      let payerParticipantStub = sandbox.stub()
      let payeeTransferStub = sandbox.stub()
      let payeeRoleTypeStub = sandbox.stub()
      let payeeCurrencyStub = sandbox.stub()
      let payeeParticipantStub = sandbox.stub()
      let ilpPacketStub = sandbox.stub()
      let stateChangeStub = sandbox.stub()
      let transferFulfilmentStub = sandbox.stub()

      let selectStub = sandbox.stub()
      let orderByStub = sandbox.stub()

      builderStub.where = sandbox.stub()

      Db.transfer.query.callsArgWith(0, builderStub)
      Db.transfer.query.returns(transfers)

      builderStub.where.returns({
        whereRaw: whereRawPc1.returns({
          whereRaw: whereRawPc2.returns({
            innerJoin: payerTransferStub.returns({
              innerJoin: payerRoleTypeStub.returns({
                innerJoin: payerCurrencyStub.returns({
                  innerJoin: payerParticipantStub.returns({
                    innerJoin: payeeTransferStub.returns({
                      innerJoin: payeeRoleTypeStub.returns({
                        innerJoin: payeeCurrencyStub.returns({
                          innerJoin: payeeParticipantStub.returns({
                            innerJoin: ilpPacketStub.returns({
                              leftJoin: stateChangeStub.returns({
                                leftJoin: transferFulfilmentStub.returns({
                                  select: selectStub.returns({
                                    orderBy: orderByStub.returns(transfers)
                                  })
                                })
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })

      sandbox.stub(transferExtensionModel, 'getByTransferId')
      transferExtensionModel.getByTransferId.returns(transferExtensions)

      let found = await Model.getAll()

      test.equal(found, transfers)
      test.ok(builderStub.where.withArgs({
        'tprt1.name': 'PAYER_DFSP',
        'tprt2.name': 'PAYEE_DFSP'
      }).calledOnce)
      test.ok(whereRawPc1.withArgs('pc1.currencyId = transfer.currencyId').calledOnce)
      test.ok(whereRawPc2.withArgs('pc2.currencyId = transfer.currencyId').calledOnce)
      test.ok(payerTransferStub.withArgs('transferParticipant AS tp1', 'tp1.transferId', 'transfer.transferId').calledOnce)
      test.ok(payerRoleTypeStub.withArgs('transferParticipantRoleType AS tprt1', 'tprt1.transferParticipantRoleTypeId', 'tp1.transferParticipantRoleTypeId').calledOnce)
      test.ok(payerCurrencyStub.withArgs('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId').calledOnce)
      test.ok(payerParticipantStub.withArgs('participant AS da', 'da.participantId', 'pc1.participantId').calledOnce)
      test.ok(payeeTransferStub.withArgs('transferParticipant AS tp2', 'tp2.transferId', 'transfer.transferId').calledOnce)
      test.ok(payeeRoleTypeStub.withArgs('transferParticipantRoleType AS tprt2', 'tprt2.transferParticipantRoleTypeId', 'tp2.transferParticipantRoleTypeId').calledOnce)
      test.ok(payeeCurrencyStub.withArgs('participantCurrency AS pc2', 'pc2.participantCurrencyId', 'tp2.participantCurrencyId').calledOnce)
      test.ok(payeeParticipantStub.withArgs('participant AS ca', 'ca.participantId', 'pc2.participantId').calledOnce)
      test.ok(ilpPacketStub.withArgs('ilpPacket AS ilpp', 'ilpp.transferId', 'transfer.transferId').calledOnce)
      test.ok(stateChangeStub.withArgs('transferStateChange AS tsc', 'tsc.transferId', 'transfer.transferId').calledOnce)
      test.ok(transferFulfilmentStub.withArgs('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId').calledOnce)
      test.ok(selectStub.withArgs(
        'transfer.*',
        'transfer.currencyId AS currency',
        'pc1.participantCurrencyId AS payerParticipantCurrencyId',
        'tp1.amount AS payerAmount',
        'da.participantId AS payerParticipantId',
        'da.name AS payerFsp',
        'pc2.participantCurrencyId AS payeeParticipantCurrencyId',
        'tp2.amount AS payeeAmount',
        'ca.participantId AS payeeParticipantId',
        'ca.name AS payeeFsp',
        'tsc.transferStateId AS transferState',
        'tsc.reason AS reason',
        'tsc.createdDate AS completedTimestamp',
        'ilpp.value AS ilpPacket',
        'transfer.ilpCondition AS condition',
        'tf.ilpFulfilment AS fulfilment'
      ).calledOnce)
      test.ok(orderByStub.withArgs('tsc.transferStateChangeId', 'desc').calledOnce)
      test.end()
    } catch (err) {
      Logger.error(`getAll failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferFacadeTest.test('getAll should throw an error', async (test) => {
    try {
      Db.transfer.query.throws(new Error())
      await Model.getAll()
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getAll failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await transferFacadeTest.test('getTransferInfoToChangePosition should return transfer', async (test) => {
    try {
      const transferId = 't1'
      const transfer = {transferId, extensionList: transferExtensions}
      const transferParticipantRoleType = Enum.TransferParticipantRoleType.PAYER_DFSP
      const ledgerEntryType = Enum.LedgerEntryType.PRINCIPLE_VALUE

      let builderStub = sandbox.stub()
      let transferStateChange = sandbox.stub()
      let selectStub = sandbox.stub()
      let orderByStub = sandbox.stub()
      let firstStub = sandbox.stub()

      builderStub.where = sandbox.stub()
      Db.transferParticipant.query.callsArgWith(0, builderStub)
      Db.transferParticipant.query.returns(transfer)

      builderStub.where.returns({
        innerJoin: transferStateChange.returns({
          select: selectStub.returns({
            orderBy: orderByStub.returns({
              first: firstStub.returns(transfer)
            })
          })
        })
      })

      let found = await Model.getTransferInfoToChangePosition(transferId, transferParticipantRoleType, ledgerEntryType)
      test.equal(found, transfer)
      test.ok(builderStub.where.withArgs({
        'transferParticipant.transferId': transferId,
        'transferParticipant.transferParticipantRoleTypeId': transferParticipantRoleType,
        'transferParticipant.ledgerEntryTypeId': ledgerEntryType
      }).calledOnce)
      test.ok(transferStateChange.withArgs('transferStateChange AS tsc', 'tsc.transferId', 'transferParticipant.transferId').calledOnce)
      test.ok(selectStub.withArgs(
        'transferParticipant.*',
        'tsc.transferStateId',
        'tsc.reason'
      ).calledOnce)
      test.ok(orderByStub.withArgs('tsc.transferStateChangeId', 'desc').calledOnce)
      test.ok(firstStub.withArgs().calledOnce)
      test.end()
    } catch (err) {
      Logger.error(`getTransferInfoToChangePosition failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferFacadeTest.test('getTransferInfoToChangePosition should throw an error', async (test) => {
    try {
      const transferId = 't1'
      Db.transferParticipant.query.throws(new Error())
      await Model.getTransferInfoToChangePosition(transferId)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getTransferInfoToChangePosition failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await transferFacadeTest.test('saveTransferFulfiled should', async saveTransferFulfiled => {
    try {
      const transferId = 't1'
      const payload = {
        fulfilment: 'f1',
        completedTimestamp: now,
        extensionList: {
          extension: transferExtensions
        }
      }
      let isCommit = null
      const stateReason = null
      let hasPassedValidation = null
      const saveTransferFulfiledExecuted = true
      const transferFulfilmentRecord = {transferFulfilmentId: 'tf1', transferId, ilpFulfilment: 'f1', completedDate: now, isValid: true, createdDate: now}
      const transferStateChangeRecord = {transferId, transferStateId: 'state', reason: stateReason, createdDate: now}
      let transferExtensionRecords = transferExtensions.map(ext => {
        return {
          transferId: transferFulfilmentRecord.transferId,
          transferFulfilmentId: transferFulfilmentRecord.transferFulfilmentId,
          key: ext.key,
          value: ext.value
        }
      })
      const saveTransferFulfiledResult = {saveTransferFulfiledExecuted, transferFulfilmentRecord, transferStateChangeRecord, transferExtensions: transferExtensionRecords}

      const ModuleProxy = Proxyquire('../../../../src/models/transfer/facade', {
        uuid4: sandbox.stub().returns(transferFulfilmentRecord.transferFulfilmentId)
      })

      await saveTransferFulfiled.test('return transfer in RECEIVED_FULFIL state', async (test) => {
        try {
          isCommit = true
          hasPassedValidation = true
          transferStateChangeRecord.transferStateId = Enum.TransferState.RECEIVED_FULFIL

          sandbox.stub(Db, 'getKnex')
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          const transactingStub = sandbox.stub()
          const insertStub = sandbox.stub()
          knexStub.returns({
            transacting: transactingStub.returns({
              insert: insertStub
            })
          })

          const response = await ModuleProxy.saveTransferFulfiled(transferId, payload, isCommit, stateReason, hasPassedValidation)
          test.deepEqual(response, saveTransferFulfiledResult, 'response matches expected result')
          test.ok(knexStub.withArgs('transferFulfilment').calledOnce, 'knex called with transferFulfilment once')
          test.ok(knexStub.withArgs('transferExtension').calledTwice, 'knex called with transferExtension twice')
          test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange once')
          test.ok(transactingStub.withArgs(trxStub).called, 'knex.transacting called with trx')
          test.ok(insertStub.withArgs(transferFulfilmentRecord).calledOnce, 'insert transferFulfilmentRecord called once')
          for (let extension of transferExtensionRecords) {
            test.ok(insertStub.withArgs(extension).calledOnce, `insert transferExtension called once with ${JSON.stringify(extension)}`)
          }
          test.ok(insertStub.withArgs(transferStateChangeRecord).calledOnce, 'insert transferStateChangeRecord called once')
          test.end()
        } catch (err) {
          Logger.error(`saveTransferFulfiled failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await saveTransferFulfiled.test('return transfer in REJECTED state', async (test) => {
        try {
          isCommit = false
          hasPassedValidation = true
          transferStateChangeRecord.transferStateId = Enum.TransferState.REJECTED

          sandbox.stub(Db, 'getKnex')
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          const transactingStub = sandbox.stub()
          const insertStub = sandbox.stub()
          knexStub.returns({
            transacting: transactingStub.returns({
              insert: insertStub
            })
          })

          const response = await ModuleProxy.saveTransferFulfiled(transferId, payload, isCommit, stateReason, hasPassedValidation)
          test.deepEqual(response, saveTransferFulfiledResult, 'response matches expected result')
          test.ok(knexStub.withArgs('transferFulfilment').calledOnce, 'knex called with transferFulfilment once')
          test.ok(knexStub.withArgs('transferExtension').calledTwice, 'knex called with transferExtension twice')
          test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange once')
          test.ok(transactingStub.withArgs(trxStub).called, 'knex.transacting called with trx')
          test.ok(insertStub.withArgs(transferFulfilmentRecord).calledOnce, 'insert transferFulfilmentRecord called once')
          for (let extension of transferExtensionRecords) {
            test.ok(insertStub.withArgs(extension).calledOnce, `insert transferExtension called once with ${JSON.stringify(extension)}`)
          }
          test.ok(insertStub.withArgs(transferStateChangeRecord).calledOnce, 'insert transferStateChangeRecord called once')
          test.end()
        } catch (err) {
          Logger.error(`saveTransferFulfiled failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await saveTransferFulfiled.test('return transfer in ABORTED state', async (test) => {
        try {
          hasPassedValidation = false
          transferStateChangeRecord.transferStateId = Enum.TransferState.ABORTED

          sandbox.stub(Db, 'getKnex')
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          const transactingStub = sandbox.stub()
          const insertStub = sandbox.stub()
          knexStub.returns({
            transacting: transactingStub.returns({
              insert: insertStub
            })
          })

          const response = await ModuleProxy.saveTransferFulfiled(transferId, payload, isCommit, stateReason, hasPassedValidation)
          test.deepEqual(response, saveTransferFulfiledResult, 'response matches expected result')
          test.ok(knexStub.withArgs('transferFulfilment').calledOnce, 'knex called with transferFulfilment once')
          test.ok(knexStub.withArgs('transferExtension').calledTwice, 'knex called with transferExtension twice')
          test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange once')
          test.ok(transactingStub.withArgs(trxStub).called, 'knex.transacting called with trx')
          test.ok(insertStub.withArgs(transferFulfilmentRecord).calledOnce, 'insert transferFulfilmentRecord called once')
          for (let extension of transferExtensionRecords) {
            test.ok(insertStub.withArgs(extension).calledOnce, `insert transferExtension called once with ${JSON.stringify(extension)}`)
          }
          test.ok(insertStub.withArgs(transferStateChangeRecord).calledOnce, 'insert transferStateChangeRecord called once')
          test.end()
        } catch (err) {
          Logger.error(`saveTransferFulfiled failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await saveTransferFulfiled.test('rollback and throw error', async (test) => {
        try {
          hasPassedValidation = false
          transferStateChangeRecord.transferStateId = Enum.TransferState.ABORTED
          payload.extensionList = null

          sandbox.stub(Db, 'getKnex')
          const trxStub = sandbox.stub()
          trxStub.rollback = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          const transactingStub = sandbox.stub()
          const insertStub = sandbox.stub()
          knexStub.returns({
            transacting: transactingStub.returns({
              insert: insertStub.throws(new Error())
            })
          })

          await ModuleProxy.saveTransferFulfiled(transferId, payload, isCommit, stateReason, hasPassedValidation)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`saveTransferFulfiled failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await saveTransferFulfiled.end()
    } catch (err) {
      Logger.error(`saveTransferFulfiled failed with error - ${err}`)
      saveTransferFulfiled.fail()
      await saveTransferFulfiled.end()
    }
  })

  await transferFacadeTest.test('saveTransferFulfiled should throw an error', async (test) => {
    try {
      const transferId = 't1'
      Db.transferParticipant.query.throws(new Error())
      await Model.saveTransferFulfiled(transferId)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`saveTransferFulfiled failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await transferFacadeTest.end()
})
