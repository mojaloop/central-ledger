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
const ParticipantFacade = require('../../../../src/models/participant/facade')
const Time = require('../../../../src/lib/time')

Test('Transfer facade', async (transferFacadeTest) => {
  let sandbox
  let clock
  let now = new Date()

  const enums = {
    transferState: {
      RESERVED: 'RESERVED',
      COMMITTED: 'COMMITTED'
    },
    transferParticipantRoleType: {
      PAYER_DFSP: 'PAYER_DFSP',
      PAYEE_DFSP: 'PAYEE_DFSP',
      DFSP_SETTLEMENT_ACCOUNT: 'DFSP_SETTLEMENT_ACCOUNT',
      DFSP_POSITION_ACCOUNT: 'DFSP_POSITION_ACCOUNT'
    },
    ledgerAccountType: {
      POSITION: 'POSITION',
      SETTLEMENT: 'SETTLEMENT'
    },
    ledgerEntryType: {
      PRINCIPLE_VALUE: 'PRINCIPLE_VALUE',
      INTERCHANGE_FEE: 'INTERCHANGE_FEE',
      HUB_FEE: 'HUB_FEE',
      SETTLEMENT_NET_RECIPIENT: 'SETTLEMENT_NET_RECIPIENT',
      SETTLEMENT_NET_SENDER: 'SETTLEMENT_NET_SENDER',
      SETTLEMENT_NET_ZERO: 'SETTLEMENT_NET_ZERO',
      RECORD_FUNDS_IN: 'RECORD_FUNDS_IN',
      RECORD_FUNDS_OUT: 'RECORD_FUNDS_OUT'
    }
  }

  const transferExtensions = [{ key: 'key1', value: 'value1' }, { key: 'key2', value: 'value2' }]

  const payloadFixture = {
    transferId: '9136780b-37e2-457c-8c05-f15dbb033b10',
    payeeFsp: 'dfsp1',
    payerFsp: 'dfsp2',
    amount: {
      amount: '100',
      currency: 'USD'
    },
    ilpPacket: 'AQAAAAAAAABkEGcuZXdwMjEuaWQuODAwMjCCAhd7InRyYW5zYWN0aW9uSWQiOiJmODU0NzdkYi0xMzVkLTRlMDgtYThiNy0xMmIyMmQ4MmMwZDYiLCJxdW90ZUlkIjoiOWU2NGYzMjEtYzMyNC00ZDI0LTg5MmYtYzQ3ZWY0ZThkZTkxIiwicGF5ZWUiOnsicGFydHlJZEluZm8iOnsicGFydHlJZFR5cGUiOiJNU0lTRE4iLCJwYXJ0eUlkZW50aWZpZXIiOiIyNTYxMjM0NTYiLCJmc3BJZCI6IjIxIn19LCJwYXllciI6eyJwYXJ0eUlkSW5mbyI6eyJwYXJ0eUlkVHlwZSI6Ik1TSVNETiIsInBhcnR5SWRlbnRpZmllciI6IjI1NjIwMTAwMDAxIiwiZnNwSWQiOiIyMCJ9LCJwZXJzb25hbEluZm8iOnsiY29tcGxleE5hbWUiOnsiZmlyc3ROYW1lIjoiTWF0cyIsImxhc3ROYW1lIjoiSGFnbWFuIn0sImRhdGVPZkJpcnRoIjoiMTk4My0xMC0yNSJ9fSwiYW1vdW50Ijp7ImFtb3VudCI6IjEwMCIsImN1cnJlbmN5IjoiVVNEIn0sInRyYW5zYWN0aW9uVHlwZSI6eyJzY2VuYXJpbyI6IlRSQU5TRkVSIiwiaW5pdGlhdG9yIjoiUEFZRVIiLCJpbml0aWF0b3JUeXBlIjoiQ09OU1VNRVIifSwibm90ZSI6ImhlaiJ9',
    condition: 'uU0nuZNNPgilLlLX2n2r-sSE7-N6U4DukIj3rOLvze1',
    expiration: '2018-11-08T21:31:00.534+01:00',
    extensionList: { extension: transferExtensions }
  }

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
    Db.transferStateChange = {
      query: sandbox.stub()
    }
    Db.settlementWindow = {
      query: sandbox.stub()
    }
    clock = Sinon.useFakeTimers(now.getTime())
    sandbox.stub(ParticipantFacade, 'getByNameAndCurrency')
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
      const transfers = [{ transferId: transferId1, extensionList: transferExtensions }, { transferId: transferId2 }]

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
      const transfers = [{ transferId: transferId1, extensionList: transferExtensions }, { transferId: transferId2 }]

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
      const transfer = { transferId, extensionList: transferExtensions }
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
      const transferFulfilmentRecord = { transferFulfilmentId: 'tf1', transferId, ilpFulfilment: 'f1', completedDate: Time.getUTCString(now), isValid: true, createdDate: Time.getUTCString(now), settlementWindowId: 1 }
      const transferStateChangeRecord = { transferId, transferStateId: 'state', reason: stateReason, createdDate: Time.getUTCString(now) }
      let transferExtensionRecords = transferExtensions.map(ext => {
        return {
          transferId: transferFulfilmentRecord.transferId,
          transferFulfilmentId: transferFulfilmentRecord.transferFulfilmentId,
          key: ext.key,
          value: ext.value
        }
      })
      const saveTransferFulfiledResult = { saveTransferFulfiledExecuted, transferFulfilmentRecord, transferStateChangeRecord, transferExtensions: transferExtensionRecords }

      const ModuleProxy = Proxyquire('../../../../src/models/transfer/facade', {
        uuid4: sandbox.stub().returns(transferFulfilmentRecord.transferFulfilmentId)
      })

      await saveTransferFulfiled.test('return transfer in RECEIVED_FULFIL state', async (test) => {
        try {
          isCommit = true
          hasPassedValidation = true
          let record = [{settlementWindowId: 1}]
          transferStateChangeRecord.transferStateId = Enum.TransferState.RECEIVED_FULFIL

          sandbox.stub(Db, 'getKnex')
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          let builderStub = sandbox.stub()
          let selectStub = sandbox.stub()
          let whereStub = sandbox.stub()
          let orderByStub = sandbox.stub()
          let firstStub = sandbox.stub()

          builderStub.leftJoin = sandbox.stub()
          Db.settlementWindow.query.callsArgWith(0, builderStub)
          Db.settlementWindow.query.returns(record)

          builderStub.leftJoin.returns({
            select: selectStub.returns({
              where: whereStub.returns({
                orderBy: orderByStub.returns({
                  first: firstStub.returns(record)
                })
              })
            })
          })

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
          let record = [{settlementWindowId: 1}]
          transferStateChangeRecord.transferStateId = Enum.TransferState.REJECTED

          sandbox.stub(Db, 'getKnex')
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          let builderStub = sandbox.stub()
          let selectStub = sandbox.stub()
          let whereStub = sandbox.stub()
          let orderByStub = sandbox.stub()
          let firstStub = sandbox.stub()

          builderStub.leftJoin = sandbox.stub()
          Db.settlementWindow.query.callsArgWith(0, builderStub)
          Db.settlementWindow.query.returns(record)

          builderStub.leftJoin.returns({
            select: selectStub.returns({
              where: whereStub.returns({
                orderBy: orderByStub.returns({
                  first: firstStub.returns(record)
                })
              })
            })
          })

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
          let record = [{settlementWindowId: 1}]
          transferStateChangeRecord.transferStateId = Enum.TransferState.ABORTED

          sandbox.stub(Db, 'getKnex')
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          let builderStub = sandbox.stub()
          let selectStub = sandbox.stub()
          let whereStub = sandbox.stub()
          let orderByStub = sandbox.stub()
          let firstStub = sandbox.stub()

          builderStub.leftJoin = sandbox.stub()
          Db.settlementWindow.query.callsArgWith(0, builderStub)
          Db.settlementWindow.query.returns(record)

          builderStub.leftJoin.returns({
            select: selectStub.returns({
              where: whereStub.returns({
                orderBy: orderByStub.returns({
                  first: firstStub.returns(record)
                })
              })
            })
          })

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

  await transferFacadeTest.test('saveTransferPrepared save prepared transfer', async (test) => {
    try {
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp1', 'USD', 1).returns('dfsp1', 1)
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp2', 'USD', 1).returns('dfsp2', 2)

      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      knexStub.batchInsert = sandbox.stub().returns({ transacting: sandbox.stub().returns(1) })
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        transacting: sandbox.stub().returns({
          insert: sandbox.stub().returns(1)
        })
      })

      const result = await Model.saveTransferPrepared(payloadFixture, null, true)
      test.equal(result, undefined, 'result matches expected result')
      test.ok(knexStub.withArgs('transfer').calledOnce, 'knex called with transfer once')
      test.ok(knexStub.withArgs('transferParticipant').calledTwice, 'knex called with transferParticipant twice')
      test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange once')
      test.ok(knexStub.batchInsert.withArgs('transferExtension').calledOnce, 'knex called with transferExtension once')
      test.end()
    } catch (err) {
      Logger.error(`saveTransferPrepared failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferFacadeTest.test('saveTransferPrepared save prepared transfer default', async (test) => {
    try {
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp1', 'USD', 1).returns('dfsp1', 1)
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp2', 'USD', 1).returns('dfsp2', 2)

      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      knexStub.batchInsert = sandbox.stub().returns({ transacting: sandbox.stub().returns(1) })
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        transacting: sandbox.stub().returns({
          insert: sandbox.stub().returns(1)
        })
      })

      const result = await Model.saveTransferPrepared(payloadFixture)
      test.equal(result, undefined, 'result matches expected result')
      test.ok(knexStub.withArgs('transfer').calledOnce, 'knex called with transfer once')
      test.ok(knexStub.withArgs('transferParticipant').calledTwice, 'knex called with transferParticipant twice')
      test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange once')
      test.ok(knexStub.batchInsert.withArgs('transferExtension').calledOnce, 'knex called with transferExtension once')
      test.end()
    } catch (err) {
      Logger.error(`saveTransferPrepared failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferFacadeTest.test('saveTransferPrepared save prepared transfer without extensionList', async (test) => {
    try {
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp1', 'USD', 1).returns('dfsp1', 1)
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp2', 'USD', 1).returns('dfsp2', 2)

      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      knexStub.batchInsert = sandbox.stub().returns({ transacting: sandbox.stub().returns(1) })
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        transacting: sandbox.stub().returns({
          insert: sandbox.stub().returns(1)
        })
      })

      const payload = Object.assign({}, payloadFixture)
      delete payload.extensionList

      const result = await Model.saveTransferPrepared(payload, null, true)
      test.equal(result, undefined, 'result matches expected result')
      test.ok(knexStub.withArgs('transfer').calledOnce, 'knex called with transfer once')
      test.ok(knexStub.withArgs('transferParticipant').calledTwice, 'knex called with transferParticipant twice')
      test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange once')
      test.end()
    } catch (err) {
      Logger.error(`saveTransferPrepared failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferFacadeTest.test('saveTransferPrepared save invalid prepared transfer', async (test) => {
    try {
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp1', 'USD', 1).returns('dfsp1', 1)
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp2', 'USD', 1).returns('dfsp2', 2)

      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      knexStub.batchInsert = sandbox.stub().returns({ transacting: sandbox.stub().returns(1) })
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        transacting: sandbox.stub().returns({
          insert: sandbox.stub().returns(1)
        })
      })

      const result = await Model.saveTransferPrepared(payloadFixture, 'Invalid Payee', false)
      test.equal(result, undefined, 'result matches expected result')
      test.ok(knexStub.withArgs('transfer').calledOnce, 'knex called with transfer once')
      test.ok(knexStub.withArgs('transferParticipant').calledTwice, 'knex called with transferParticipant twice')
      test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange once')
      test.ok(knexStub.batchInsert.withArgs('transferExtension').calledOnce, 'knex called with transferExtension once')
      test.end()
    } catch (err) {
      Logger.error(`saveTransferPrepared failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferFacadeTest.test('saveTransferPrepared should throw error', async (test) => {
    try {
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp1', 'USD', 1).returns('dfsp1', 1)
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp2', 'USD', 1).returns('dfsp1', 1)

      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      knexStub.batchInsert = sandbox.stub().returns({ transacting: sandbox.stub().returns(1) })
      Db.getKnex.returns(knexStub)
      knexStub.throws(new Error())

      await Model.saveTransferPrepared(payloadFixture, 'Invalid Payee', false)
      test.fail(' should throw')
      test.end()
      test.end()
    } catch (err) {
      test.pass('Error thrown')
      test.end()
    }
  })

  await transferFacadeTest.test('saveTransferPrepared should throw error when any participant is not found', async (test) => {
    try {
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp1', 'USD', 1).returns('dfsp1', 1)
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp2', 'USD', 1).returns(null)

      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      knexStub.batchInsert = sandbox.stub().returns({ transacting: sandbox.stub().returns(1) })
      Db.getKnex.returns(knexStub)
      knexStub.throws(new Error())

      await Model.saveTransferPrepared(payloadFixture, 'Invalid Payee', false)
      test.fail(' should throw')
      test.end()
      test.end()
    } catch (err) {
      test.pass('Error thrown')
      test.end()
    }
  })

  await transferFacadeTest.test('getTransferStateByTransferId', async (test) => {
    try {
      const transferStateChange = {
        transferStateChangeId: 1,
        transferId: '9136780b-37e2-457c-8c05-f15dbb033b10',
        transferStateId: 'COMMITTED',
        reason: null,
        createdDate: '2018-08-15 13:44:38',
        enumeration: 'COMMITTED'
      }
      let builderStub = sandbox.stub()
      Db.transferStateChange.query.callsArgWith(0, builderStub)
      builderStub.innerJoin = sandbox.stub()

      builderStub.innerJoin.returns({
        where: sandbox.stub().returns({
          select: sandbox.stub().returns({
            orderBy: sandbox.stub().returns({
              first: sandbox.stub().returns(transferStateChange)
            })
          })
        })
      })

      var result = await Model.getTransferStateByTransferId(transferStateChange.transferId)
      test.deepEqual(result, transferStateChange)
      test.end()
    } catch (err) {
      Logger.error(`getTransferStateByTransferId failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferFacadeTest.test('getTransferStateByTransferId should throw error', async (assert) => {
    try {
      Db.transferStateChange.query.throws(new Error('message'))
      await Model.getTransferStateByTransferId('id')
      assert.fail('Should throw')
      assert.end()
    } catch (err) {
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await transferFacadeTest.test('timeoutExpireReserved should', async timeoutExpireReservedTest => {
    try {
      await timeoutExpireReservedTest.test('throw error and rollback within transaction', async test => {
        try {
          const segmentId = 1
          const intervalMin = 1
          const intervalMax = 10

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          knexStub.from = sandbox.stub().throws(new Error('Custom error'))

          await Model.timeoutExpireReserved(segmentId, intervalMin, intervalMax)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`timeoutExpireReserved failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await timeoutExpireReservedTest.test('perform timeout successfully', async test => {
        try {
          let segmentId
          const intervalMin = 1
          const intervalMax = 10
          const expectedResult = 1

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          let context = sandbox.stub()
          context.from = sandbox.stub().returns({
            innerJoin: sandbox.stub().returns({
              innerJoin: sandbox.stub().returns({
                whereIn: sandbox.stub().returns({
                  select: sandbox.stub()
                }),
                where: sandbox.stub().returns({
                  andWhere: sandbox.stub().returns({
                    select: sandbox.stub()
                  })
                })
              })
            })
          })
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub().returns({
              andOn: sandbox.stub()
            })
          })
          knexStub.returns({
            select: sandbox.stub().returns({
              max: sandbox.stub().returns({
                where: sandbox.stub().returns({
                  andWhere: sandbox.stub().returns({
                    groupBy: sandbox.stub().returns({
                      as: sandbox.stub()
                    })
                  })
                }),
                innerJoin: sandbox.stub().returns({
                  groupBy: sandbox.stub().returns({
                    as: sandbox.stub()
                  })
                })
              })
            }),
            transacting: sandbox.stub().returns({
              insert: sandbox.stub(),
              where: sandbox.stub().returns({
                update: sandbox.stub()
              })
            }),
            innerJoin: sandbox.stub().returns({
              innerJoin: sandbox.stub().returns({
                innerJoin: sandbox.stub().callsArgOn(1, context).returns({
                  innerJoin: sandbox.stub().callsArgOn(1, context).returns({
                    innerJoin: sandbox.stub().returns({
                      innerJoin: sandbox.stub().returns({
                        innerJoin: sandbox.stub().returns({
                          innerJoin: sandbox.stub().returns({
                            where: sandbox.stub().returns({
                              select: sandbox.stub().returns(
                                Promise.resolve(expectedResult)
                              )
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
          knexStub.raw = sandbox.stub()
          knexStub.from = sandbox.stub().returns({
            transacting: sandbox.stub().returns({
              insert: sandbox.stub().callsArgOn(0, context)
            })
          })

          let result
          try {
            segmentId = 0
            result = await Model.timeoutExpireReserved(segmentId, intervalMin, intervalMax)
            test.equal(result, expectedResult, 'Expected result returned')
          } catch (err) {
            Logger.error(`timeoutExpireReserved failed with error - ${err}`)
            test.fail()
          }
          try {
            segmentId = 1
            await Model.timeoutExpireReserved(segmentId, intervalMin, intervalMax)
            test.equal(result, expectedResult, 'Expected result returned.')
          } catch (err) {
            Logger.error(`timeoutExpireReserved failed with error - ${err}`)
            test.fail()
          }
          test.end()
        } catch (err) {
          Logger.error(`timeoutExpireReserved failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await timeoutExpireReservedTest.end()
    } catch (err) {
      Logger.error(`transferFacadeTest failed with error - ${err}`)
      timeoutExpireReservedTest.fail()
      timeoutExpireReservedTest.end()
    }
  })

  await transferFacadeTest.test('reconciliationPositionChange should', async reconciliationPositionChangeTest => {
    try {
      await reconciliationPositionChangeTest.test('throw error if database is not available', async test => {
        try {
          const payload = {}
          const transferStateId = 1
          const transactionTimestamp = Time.getUTCString(now)
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub().throws(new Error('Database unavailable'))
          sandbox.stub(Db, 'getKnex').returns(knexStub)

          await Model.reconciliationPositionChange(payload, transferStateId, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationPositionChange failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationPositionChangeTest.test('change position when called from within a transaction', async test => {
        try {
          const payload = {
            action: Enum.adminTransferAction.RECORD_FUNDS_IN,
            participantCurrencyId: 2,
            amount: {
              amount: 10,
              currency: 'USD'
            }
          }
          const transferStateId = 1
          const transactionTimestamp = Time.getUTCString(now)
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.withArgs('participantCurrency').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns(
                      Promise.resolve({
                        reconciliationAccountId: 1
                      })
                    )
                  })
                })
              })
            })
          })
          let participantPositionWhereStub = sandbox.stub()
          participantPositionWhereStub.withArgs('participantCurrencyId', 1).returns({
            first: sandbox.stub().returns({
              transacting: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns(
                  Promise.resolve({
                    reconciliationPositionId: 1,
                    reconciliationPositionValue: 0
                  })
                )
              })
            })
          })
          participantPositionWhereStub.withArgs('participantCurrencyId', 2).returns({
            first: sandbox.stub().returns({
              transacting: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns(
                  Promise.resolve({
                    settlementPositionId: 2,
                    settlementPositionValue: 0
                  })
                )
              })
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: participantPositionWhereStub
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('transferStateChange').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(9)
            })
          })
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          const expectedResult = {
            hubReconciliationAccountPosition: 10,
            participantSettlementAccountPosition: -10
          }

          let result = await Model.reconciliationPositionChange(payload, transferStateId, transactionTimestamp, enums, trxStub)
          test.deepEqual(result, expectedResult, 'Expected result is returned')
          test.equal(knexStub.withArgs('participantCurrency').callCount, 1)
          test.equal(knexStub.withArgs('participantPosition').callCount, 4)
          test.equal(knexStub.withArgs('transferStateChange').callCount, 1)
          test.equal(knexStub.withArgs('participantPositionChange').callCount, 2)
          test.end()
        } catch (err) {
          Logger.error(`reconciliationPositionChange failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await reconciliationPositionChangeTest.test('throw error if insert participantPositionChange fails', async test => {
        try {
          const payload = {
            action: Enum.adminTransferAction.RECORD_FUNDS_OUT_COMMIT,
            participantCurrencyId: 2,
            amount: {
              amount: 10,
              currency: 'USD'
            }
          }
          const transferStateId = 1
          const transactionTimestamp = Time.getUTCString(now)
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.withArgs('participantCurrency').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns(
                      Promise.resolve({
                        reconciliationAccountId: 1
                      })
                    )
                  })
                })
              })
            })
          })
          let participantPositionWhereStub = sandbox.stub()
          participantPositionWhereStub.withArgs('participantCurrencyId', 1).returns({
            first: sandbox.stub().returns({
              transacting: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns(
                  Promise.resolve({
                    reconciliationPositionId: 1,
                    reconciliationPositionValue: 0
                  })
                )
              })
            })
          })
          participantPositionWhereStub.withArgs('participantCurrencyId', 2).returns({
            first: sandbox.stub().returns({
              transacting: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns(
                  Promise.resolve({
                    settlementPositionId: 2,
                    settlementPositionValue: 0
                  })
                )
              })
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: participantPositionWhereStub
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('transferStateChange').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(11)
            })
          })
          knexStub.returns({
            insert: sandbox.stub().throws(new Error('Insert failed'))
          })

          await Model.reconciliationPositionChange(payload, transferStateId, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationPositionChange failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationPositionChangeTest.test('change position when called in a new transaction and commit it when called from outside of a transaction', async test => {
        try {
          const payload = {
            action: Enum.adminTransferAction.RECORD_FUNDS_OUT_PREPARE,
            participantCurrencyId: 2,
            amount: {
              amount: 10,
              currency: 'USD'
            }
          }
          const transferStateId = 1
          const transactionTimestamp = Time.getUTCString(now)

          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.withArgs('participantCurrency').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns(
                      Promise.resolve({
                        reconciliationAccountId: 1
                      })
                    )
                  })
                })
              })
            })
          })
          let participantPositionWhereStub = sandbox.stub()
          participantPositionWhereStub.withArgs('participantCurrencyId', 1).returns({
            first: sandbox.stub().returns({
              transacting: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns(
                  Promise.resolve({
                    reconciliationPositionId: 1,
                    reconciliationPositionValue: 0
                  })
                )
              })
            })
          })
          participantPositionWhereStub.withArgs('participantCurrencyId', 2).returns({
            first: sandbox.stub().returns({
              transacting: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns(
                  Promise.resolve({
                    settlementPositionId: 2,
                    settlementPositionValue: 0
                  })
                )
              })
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: participantPositionWhereStub
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('transferStateChange').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(9)
            })
          })
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          const expectedResult = {
            hubReconciliationAccountPosition: -10,
            participantSettlementAccountPosition: 10
          }

          let result = await Model.reconciliationPositionChange(payload, transferStateId, transactionTimestamp, enums)
          test.deepEqual(result, expectedResult, 'Expected result is returned')
          test.equal(knexStub.withArgs('participantCurrency').callCount, 1)
          test.equal(knexStub.withArgs('participantPosition').callCount, 4)
          test.equal(knexStub.withArgs('transferStateChange').callCount, 1)
          test.equal(knexStub.withArgs('participantPositionChange').callCount, 2)
          test.end()
        } catch (err) {
          Logger.error(`reconciliationPositionChange failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await reconciliationPositionChangeTest.test('throw error and rollback when called outside of a transaction', async test => {
        try {
          const payload = {
            action: Enum.adminTransferAction.RECORD_FUNDS_IN,
            participantCurrencyId: 2,
            amount: {
              amount: 10,
              currency: 'USD'
            }
          }
          const transferStateId = 1
          const transactionTimestamp = Time.getUTCString(now)

          const knexStub = sandbox.stub()
          let trxStub = sandbox.stub()
          trxStub.rollback = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.withArgs('participantCurrency').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns(
                      Promise.resolve({
                        reconciliationAccountId: 1
                      })
                    )
                  })
                })
              })
            })
          })
          let participantPositionWhereStub = sandbox.stub()
          participantPositionWhereStub.withArgs('participantCurrencyId', 1).returns({
            first: sandbox.stub().returns({
              transacting: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns(
                  Promise.resolve({
                    reconciliationPositionId: 1,
                    reconciliationPositionValue: 0
                  })
                )
              })
            })
          })
          participantPositionWhereStub.withArgs('participantCurrencyId', 2).returns({
            first: sandbox.stub().returns({
              transacting: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns(
                  Promise.resolve({
                    settlementPositionId: 2,
                    settlementPositionValue: 0
                  })
                )
              })
            })
          })
          knexStub.withArgs('participantPosition').returns({
            select: sandbox.stub().returns({
              where: participantPositionWhereStub
            }),
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('transferStateChange').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(11)
            })
          })
          knexStub.returns({
            insert: sandbox.stub().throws(new Error('Insert failed'))
          })

          await Model.reconciliationPositionChange(payload, transferStateId, transactionTimestamp, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationPositionChange failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationPositionChangeTest.end()
    } catch (err) {
      Logger.error(`transferFacadeTest failed with error - ${err}`)
      reconciliationPositionChangeTest.fail()
      reconciliationPositionChangeTest.end()
    }
  })

  await transferFacadeTest.test('reconciliationTransferPrepare should', async reconciliationTransferPrepareTest => {
    try {
      await reconciliationTransferPrepareTest.test('throw error if database is not available', async test => {
        try {
          const payload = {}
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub().throws(new Error('Database unavailable'))
          sandbox.stub(Db, 'getKnex').returns(knexStub)

          await Model.reconciliationTransferPrepare(payload, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferPrepare failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationTransferPrepareTest.test('make reconciliation transfer prepare when called from within a transaction', async test => {
        try {
          const payload = {
            action: Enum.adminTransferAction.RECORD_FUNDS_OUT_PREPARE,
            participantCurrencyId: 2,
            amount: {
              amount: 10,
              currency: 'USD'
            },
            externalReference: 'ref123',
            extensionList: {
              extension: [
                {
                  key: 'key1',
                  value: 'value1'
                },
                {
                  key: 'key2',
                  value: 'value2'
                }
              ]
            }
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantCurrency').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns(
                      Promise.resolve({
                        reconciliationAccountId: 1
                      })
                    )
                  })
                })
              })
            })
          })
          sandbox.stub(Model, 'reconciliationPositionChange').returns({
            participantSettlementAccountPosition: -10
          })
          sandbox.stub(Model, 'reconciliationTransferAbort')

          let result = await Model.reconciliationTransferPrepare(payload, transactionTimestamp, enums, trxStub)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub.withArgs('transfer').callCount, 1)
          test.equal(knexStub.withArgs('participantCurrency').callCount, 1)
          test.equal(knexStub.withArgs('transferParticipant').callCount, 2)
          test.equal(knexStub.withArgs('transferStateChange').callCount, 0)
          test.equal(knexStub.withArgs('transferExtension').callCount, 3)
          test.equal(Model.reconciliationPositionChange.callCount, 1)
          test.equal(Model.reconciliationTransferAbort.callCount, 0)
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferPrepare failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await reconciliationTransferPrepareTest.test('throw error if insert fails', async test => {
        try {
          const payload = {
            action: Enum.adminTransferAction.RECORD_FUNDS_OUT_ABORT,
            participantCurrencyId: 2,
            amount: {
              amount: 10,
              currency: 'USD'
            },
            externalReference: 'ref123',
            extensionList: {
              extension: [
                {
                  key: 'key1',
                  value: 'value1'
                },
                {
                  key: 'key2',
                  value: 'value2'
                }
              ]
            }
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.withArgs('transfer').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('transferParticipant').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(new Error('Insert failed'))
            })
          })
          knexStub.returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns({
                      reconciliationAccountId: 1
                    })
                  })
                })
              })
            })
          })
          await Model.reconciliationTransferPrepare(payload, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferPrepare failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationTransferPrepareTest.test('make reconciliation transfer commit in a new transaction and commit it when called outside of a transaction', async test => {
        try {
          const payload = {
            action: Enum.adminTransferAction.RECORD_FUNDS_IN,
            participantCurrencyId: 2,
            amount: {
              amount: 10,
              currency: 'USD'
            },
            externalReference: 'ref123'
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.commit = sandbox.stub()

          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantCurrency').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns(
                      Promise.resolve({
                        reconciliationAccountId: 1
                      })
                    )
                  })
                })
              })
            })
          })
          sandbox.stub(Model, 'reconciliationPositionChange').returns({
            participantSettlementAccountPosition: -10
          })
          sandbox.stub(Model, 'reconciliationTransferAbort')

          let result = await Model.reconciliationTransferPrepare(payload, transactionTimestamp, enums)
          test.equal(result, 0, 'Result for successful operation returned')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferPrepare failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await reconciliationTransferPrepareTest.test('throw error and rollback when called outside of a transaction', async test => {
        try {
          const payload = {
            action: Enum.adminTransferAction.RECORD_FUNDS_OUT_PREPARE,
            participantCurrencyId: 2,
            amount: {
              amount: 10,
              currency: 'USD'
            },
            externalReference: 'ref123'
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.rollback = sandbox.stub()

          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('participantCurrency').returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns({
                andWhere: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    transacting: sandbox.stub().returns(
                      Promise.resolve({
                        reconciliationAccountId: 1
                      })
                    )
                  })
                })
              })
            })
          })
          sandbox.stub(Model, 'reconciliationPositionChange').returns({
            participantSettlementAccountPosition: 10
          })
          sandbox.stub(Model, 'reconciliationTransferAbort').throws(new Error('Reconciliation Transfer Abort Failure'))

          await Model.reconciliationTransferPrepare(payload, transactionTimestamp, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferPrepare failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationTransferPrepareTest.end()
    } catch (err) {
      Logger.error(`transferFacadeTest failed with error - ${err}`)
      reconciliationTransferPrepareTest.fail()
      reconciliationTransferPrepareTest.end()
    }
  })

  await transferFacadeTest.test('reconciliationTransferCommit should', async reconciliationTransferCommitTest => {
    try {
      await reconciliationTransferCommitTest.test('throw error if database is not available', async test => {
        try {
          const payload = {}
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub().throws(new Error('Database unavailable'))
          sandbox.stub(Db, 'getKnex').returns(knexStub)

          await Model.reconciliationTransferCommit(payload, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferPrepare failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationTransferCommitTest.test('make transfer commit when called from within a transaction', async test => {
        try {
          const payload = {
            transferId: 1,
            action: Enum.adminTransferAction.RECORD_FUNDS_OUT_COMMIT,
            participantCurrencyId: 2
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          sandbox.stub(Model, 'reconciliationPositionChange').returns({
            participantSettlementAccountPosition: 10
          })

          let result = await Model.reconciliationTransferCommit(payload, transactionTimestamp, enums, trxStub)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub().insert.callCount, 2)
          test.equal(Model.reconciliationPositionChange.callCount, 0)
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferCommit failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await reconciliationTransferCommitTest.test('throw error if insert fails', async test => {
        try {
          const payload = {
            transferId: 1,
            action: Enum.adminTransferAction.RECORD_FUNDS_OUT_COMMIT,
            participantCurrencyId: 2
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.withArgs('transferFulfilment').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          knexStub.withArgs('transferStateChange').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(new Error('Insert fails!'))
            })
          })
          sandbox.stub(Model, 'reconciliationPositionChange').returns({
            participantSettlementAccountPosition: 10
          })

          await Model.reconciliationTransferCommit(payload, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferCommit failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationTransferCommitTest.test('make transfer commit in a new transaction and commit it when called from outside of a transaction', async test => {
        try {
          const payload = {
            transferId: 1,
            action: Enum.adminTransferAction.RECORD_FUNDS_IN,
            participantCurrencyId: 2
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.commit = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          sandbox.stub(Model, 'reconciliationPositionChange').returns({
            participantSettlementAccountPosition: 10
          })

          let result = await Model.reconciliationTransferCommit(payload, transactionTimestamp, enums)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub().insert.callCount, 1)
          test.equal(Model.reconciliationPositionChange.callCount, 1)
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferCommit failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await reconciliationTransferCommitTest.test('throw error and rollback when called outside of a transaction', async test => {
        try {
          const payload = {
            transferId: 1,
            action: Enum.adminTransferAction.RECORD_FUNDS_OUT_ABORT,
            participantCurrencyId: 2
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          trxStub.rollback = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })

          await Model.reconciliationTransferCommit(payload, transactionTimestamp, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferCommit failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationTransferCommitTest.end()
    } catch (err) {
      Logger.error(`transferFacadeTest failed with error - ${err}`)
      reconciliationTransferCommitTest.fail()
      reconciliationTransferCommitTest.end()
    }
  })

  await transferFacadeTest.test('reconciliationTransferAbort should', async reconciliationTransferAbortTest => {
    try {
      await reconciliationTransferAbortTest.test('throw error if database is not available', async test => {
        try {
          const payload = {}
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub().throws(new Error('Database unavailable'))
          sandbox.stub(Db, 'getKnex').returns(knexStub)

          await Model.reconciliationTransferAbort(payload, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferPrepare failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationTransferAbortTest.test('make transfer abort when called from within a transaction', async test => {
        try {
          const payload = {
            transferId: 1,
            action: Enum.adminTransferAction.RECORD_FUNDS_OUT_ABORT,
            participantCurrencyId: 2
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          sandbox.stub(Model, 'reconciliationPositionChange').returns({
            participantSettlementAccountPosition: -10
          })

          let result = await Model.reconciliationTransferAbort(payload, transactionTimestamp, enums, trxStub)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub().insert.callCount, 1)
          test.equal(Model.reconciliationPositionChange.callCount, 1)
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferAbort failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await reconciliationTransferAbortTest.test('throw error if insert fails', async test => {
        try {
          const payload = {
            transferId: 1,
            action: Enum.adminTransferAction.RECORD_FUNDS_OUT_ABORT,
            participantCurrencyId: 2
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.withArgs('transferFulfilment').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(new Error('Insert fails!'))
            })
          })

          await Model.reconciliationTransferAbort(payload, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferAbort failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationTransferAbortTest.test('make transfer commit in a new transaction and commit it when called from outside of a transaction', async test => {
        try {
          const payload = {
            transferId: 1,
            action: Enum.adminTransferAction.RECORD_FUNDS_OUT_ABORT,
            participantCurrencyId: 2
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          trxStub.commit = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })
          sandbox.stub(Model, 'reconciliationPositionChange').returns({
            participantSettlementAccountPosition: -10
          })

          let result = await Model.reconciliationTransferAbort(payload, transactionTimestamp, enums)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub().insert.callCount, 1)
          test.equal(Model.reconciliationPositionChange.callCount, 1)
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferAbort failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await reconciliationTransferAbortTest.test('throw error and rollback when called outside of a transaction', async test => {
        try {
          const payload = {
            transferId: 1,
            action: Enum.adminTransferAction.RECORD_FUNDS_OUT_ABORT,
            participantCurrencyId: 2
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          trxStub.rollback = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().throws(new Error('Insert fails!'))
            })
          })

          await Model.reconciliationTransferAbort(payload, transactionTimestamp, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferAbort failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationTransferAbortTest.end()
    } catch (err) {
      Logger.error(`transferFacadeTest failed with error - ${err}`)
      reconciliationTransferAbortTest.fail()
      reconciliationTransferAbortTest.end()
    }
  })

  await transferFacadeTest.end()
})
