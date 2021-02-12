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
const Config = require('../../../../src/lib/config')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const MLNumber = require('@mojaloop/ml-number')
const TransferFacade = require('../../../../src/models/transfer/facade')
const transferExtensionModel = require('../../../../src/models/transfer/transferExtension')
const Enum = require('@mojaloop/central-services-shared').Enum
const TransferEventAction = Enum.Events.Event.Action
// const Proxyquire = require('proxyquire')
const ParticipantFacade = require('../../../../src/models/participant/facade')
const Time = require('@mojaloop/central-services-shared').Util.Time
const Uuid = require('uuid4')
const cloneDeep = require('lodash').cloneDeep

Test('Transfer facade', async (transferFacadeTest) => {
  let sandbox
  let clock
  const now = new Date()

  const enums = {
    transferState: {
      RESERVED: 'RESERVED',
      COMMITTED: 'COMMITTED',
      ABORTED_REJECTED: 'ABORTED_REJECTED'
    },
    transferParticipantRoleType: {
      PAYER_DFSP: 'PAYER_DFSP',
      PAYEE_DFSP: 'PAYEE_DFSP',
      DFSP_SETTLEMENT: 'DFSP_SETTLEMENT',
      DFSP_POSITION: 'DFSP_POSITION'
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
    Db.participant = {
      query: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
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
      const extensions = cloneDeep(transferExtensions)
      const transfers = [
        { transferId: transferId1, extensionList: extensions },
        { transferId: transferId2, errorCode: 5105, transferStateEnumeration: Enum.Transfers.TransferState.ABORTED, extensionList: [{ key: 'key1', value: 'value1' }, { key: 'key2', value: 'value2' }, { key: 'cause', value: '5105: undefined' }], isTransferReadModel: true }
      ]

      const builderStub = sandbox.stub()
      const whereRawPc1 = sandbox.stub()
      const whereRawPc2 = sandbox.stub()
      const payerTransferStub = sandbox.stub()
      const payerRoleTypeStub = sandbox.stub()
      const payerCurrencyStub = sandbox.stub()
      const payerParticipantStub = sandbox.stub()
      const payeeTransferStub = sandbox.stub()
      const payeeRoleTypeStub = sandbox.stub()
      const payeeCurrencyStub = sandbox.stub()
      const payeeParticipantStub = sandbox.stub()
      const ilpPacketStub = sandbox.stub()
      const stateChangeStub = sandbox.stub()
      const stateStub = sandbox.stub()
      const transferFulfilmentStub = sandbox.stub()
      const transferErrorStub = sandbox.stub()

      const selectStub = sandbox.stub()
      const orderByStub = sandbox.stub()
      const firstStub = sandbox.stub()

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
                                leftJoin: stateStub.returns({
                                  leftJoin: transferFulfilmentStub.returns({
                                    leftJoin: transferErrorStub.returns({
                                      select: selectStub.returns({
                                        orderBy: orderByStub.returns({
                                          first: firstStub.returns(transfers[0])
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
        })
      })

      sandbox.stub(transferExtensionModel, 'getByTransferId')
      transferExtensionModel.getByTransferId.returns(extensions)

      const found = await TransferFacade.getById(transferId1)
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
      test.ok(stateStub.withArgs('transferState AS ts', 'ts.transferStateId', 'tsc.transferStateId').calledOnce)
      test.ok(transferFulfilmentStub.withArgs('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId').calledOnce)
      test.ok(transferErrorStub.withArgs('transferError as te', 'te.transferId', 'transfer.transferId').calledOnce)
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
        'ts.enumeration as transferStateEnumeration',
        'ts.description as transferStateDescription',
        'ilpp.value AS ilpPacket',
        'transfer.ilpCondition AS condition',
        'tf.ilpFulfilment AS fulfilment'
      ).calledOnce)
      test.ok(orderByStub.withArgs('tsc.transferStateChangeId', 'desc').calledOnce)
      test.ok(firstStub.withArgs().calledOnce)

      Db.transfer.query.returns(transfers[1])
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
                                leftJoin: stateStub.returns({
                                  leftJoin: transferFulfilmentStub.returns({
                                    leftJoin: transferErrorStub.returns({
                                      select: selectStub.returns({
                                        orderBy: orderByStub.returns({
                                          first: firstStub.returns(transfers[1])
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
        })
      })
      const found2 = await TransferFacade.getById(transferId2)
      // TODO: extend testing for the current code branch
      test.deepEqual(found2, transfers[1])

      transferExtensionModel.getByTransferId.returns(null)
      const found3 = await TransferFacade.getById(transferId2)
      // TODO: extend testing for the current code branch
      test.equal(found3, transfers[1])
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
      const builderStub = sandbox.stub()
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
        })
      })
      const found = await TransferFacade.getById(transferId1)
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
      await TransferFacade.getById(transferId1)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getById failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await transferFacadeTest.test('getByIdLight should return transfer by id for RESERVED', async (test) => {
    try {
      const transferId1 = 't1'
      const transferId2 = 't2'
      const extensions = cloneDeep(transferExtensions)
      const transfer = { transferId: transferId1, extensionList: extensions }
      const transfer2 = { transferId: transferId2, errorCode: 5105, transferStateEnumeration: Enum.Transfers.TransferState.ABORTED }

      const builderStub = sandbox.stub()
      const ilpPacketStub = sandbox.stub()
      const stateChangeStub = sandbox.stub()
      const transferStateStub = sandbox.stub()
      const transferFulfilmentStub = sandbox.stub()
      const transferErrorStub = sandbox.stub()

      const selectStub = sandbox.stub()
      const orderByStub = sandbox.stub()
      const firstStub = sandbox.stub()

      builderStub.where = sandbox.stub()

      Db.transfer.query.callsArgWith(0, builderStub)
      Db.transfer.query.returns(transfer)

      builderStub.where.returns({
        leftJoin: ilpPacketStub.returns({
          leftJoin: stateChangeStub.returns({
            leftJoin: transferStateStub.returns({
              leftJoin: transferFulfilmentStub.returns({
                leftJoin: transferErrorStub.returns({
                  select: selectStub.returns({
                    orderBy: orderByStub.returns({
                      first: firstStub.returns(transfer)
                    })
                  })
                })
              })
            })
          })
        })
      })

      sandbox.stub(transferExtensionModel, 'getByTransferId')
      transferExtensionModel.getByTransferId.returns(extensions)

      const found = await TransferFacade.getByIdLight(transferId1)
      test.equal(found, transfer)
      test.ok(builderStub.where.withArgs({ 'transfer.transferId': transferId1 }).calledOnce)
      test.ok(ilpPacketStub.withArgs('ilpPacket AS ilpp', 'ilpp.transferId', 'transfer.transferId').calledOnce)
      test.ok(stateChangeStub.withArgs('transferStateChange AS tsc', 'tsc.transferId', 'transfer.transferId').calledOnce)
      test.ok(transferFulfilmentStub.withArgs('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId').calledOnce)
      test.ok(transferErrorStub.withArgs('transferError as te', 'te.transferId', 'transfer.transferId').calledOnce)
      test.ok(selectStub.withArgs(
        'transfer.*',
        'transfer.currencyId AS currency',
        'tsc.transferStateChangeId',
        'tsc.transferStateId AS transferState',
        'ts.enumeration AS transferStateEnumeration',
        'ts.description as transferStateDescription',
        'tsc.reason AS reason',
        'tsc.createdDate AS completedTimestamp',
        'ilpp.value AS ilpPacket',
        'transfer.ilpCondition AS condition',
        'tf.ilpFulfilment AS fulfilment'
      ).calledOnce)
      test.ok(orderByStub.withArgs('tsc.transferStateChangeId', 'desc').calledOnce)
      test.ok(firstStub.withArgs().calledOnce)

      Db.transfer.query.returns(transfer2)
      builderStub.where.returns({
        leftJoin: ilpPacketStub.returns({
          leftJoin: stateChangeStub.returns({
            leftJoin: transferStateStub.returns({
              leftJoin: transferFulfilmentStub.returns({
                leftJoin: transferErrorStub.returns({
                  select: selectStub.returns({
                    orderBy: orderByStub.returns({
                      first: firstStub.returns(transfer2)
                    })
                  })
                })
              })
            })
          })
        })
      })
      const found2 = await TransferFacade.getByIdLight(transferId2)
      // TODO: extend testing for the current code branch
      test.equal(found2, transfer2)

      transferExtensionModel.getByTransferId.returns(null)
      const found3 = await TransferFacade.getByIdLight(transferId2)
      // TODO: extend testing for the current code branch
      test.equal(found3, transfer2)
      test.end()
    } catch (err) {
      Logger.error(`getByIdLight failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferFacadeTest.test('getByIdLight should return transfer by id for COMMITTED', async (test) => {
    try {
      const transferId = 't1'
      const fulfilment = 'ff1'
      const extensions = cloneDeep(transferExtensions)
      const transfer = { transferId, fulfilment, extensionList: extensions }

      const builderStub = sandbox.stub()
      const ilpPacketStub = sandbox.stub()
      const stateChangeStub = sandbox.stub()
      const transferStateStub = sandbox.stub()
      const transferFulfilmentStub = sandbox.stub()
      const transferErrorStub = sandbox.stub()

      const selectStub = sandbox.stub()
      const orderByStub = sandbox.stub()
      const firstStub = sandbox.stub()

      builderStub.where = sandbox.stub()

      Db.transfer.query.callsArgWith(0, builderStub)
      Db.transfer.query.returns(transfer)

      builderStub.where.returns({
        leftJoin: ilpPacketStub.returns({
          leftJoin: stateChangeStub.returns({
            leftJoin: transferStateStub.returns({
              leftJoin: transferFulfilmentStub.returns({
                leftJoin: transferErrorStub.returns({
                  select: selectStub.returns({
                    orderBy: orderByStub.returns({
                      first: firstStub.returns(transfer)
                    })
                  })
                })
              })
            })
          })
        })
      })

      sandbox.stub(transferExtensionModel, 'getByTransferId')
      transferExtensionModel.getByTransferId.returns(extensions)

      const found = await TransferFacade.getByIdLight(transferId)
      test.equal(found, transfer)
      test.ok(builderStub.where.withArgs({ 'transfer.transferId': transferId }).calledOnce)
      test.ok(ilpPacketStub.withArgs('ilpPacket AS ilpp', 'ilpp.transferId', 'transfer.transferId').calledOnce)
      test.ok(stateChangeStub.withArgs('transferStateChange AS tsc', 'tsc.transferId', 'transfer.transferId').calledOnce)
      test.ok(transferFulfilmentStub.withArgs('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId').calledOnce)
      test.ok(transferErrorStub.withArgs('transferError as te', 'te.transferId', 'transfer.transferId').calledOnce)
      test.ok(selectStub.withArgs(
        'transfer.*',
        'transfer.currencyId AS currency',
        'tsc.transferStateChangeId',
        'tsc.transferStateId AS transferState',
        'ts.enumeration AS transferStateEnumeration',
        'ts.description as transferStateDescription',
        'tsc.reason AS reason',
        'tsc.createdDate AS completedTimestamp',
        'ilpp.value AS ilpPacket',
        'transfer.ilpCondition AS condition',
        'tf.ilpFulfilment AS fulfilment',
        'te.errorCode',
        'te.errorDescription'
      ).calledOnce)
      test.ok(orderByStub.withArgs('tsc.transferStateChangeId', 'desc').calledOnce)
      test.ok(firstStub.withArgs().calledOnce)
      test.end()
    } catch (err) {
      Logger.error(`getByIdLight failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferFacadeTest.test('getByIdLight should find zero records', async (test) => {
    try {
      const transferId1 = 't1'
      const builderStub = sandbox.stub()
      Db.transfer.query.callsArgWith(0, builderStub)
      builderStub.where = sandbox.stub()
      builderStub.where.returns({
        leftJoin: sandbox.stub().returns({
          leftJoin: sandbox.stub().returns({
            leftJoin: sandbox.stub().returns({
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
      const found = await TransferFacade.getByIdLight(transferId1)
      test.equal(found, null, 'no transfers were found')
      test.end()
    } catch (err) {
      Logger.error(`getByIdLight failed with error - ${err}`)
      test.fail('Error thrown')
      test.end()
    }
  })

  await transferFacadeTest.test('getByIdLight should throw an error', async (test) => {
    try {
      const transferId1 = 't1'
      Db.transfer.query.throws(new Error())
      await TransferFacade.getByIdLight(transferId1)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getByIdLight failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await transferFacadeTest.test('getAll should return all transfers', async (test) => {
    try {
      const transferId1 = 't1'
      const transferId2 = 't2'
      const extensions = cloneDeep(transferExtensions)
      const transfers = [{ transferId: transferId1, extensionList: extensions }, { transferId: transferId2 }]

      const builderStub = sandbox.stub()
      const whereRawPc1 = sandbox.stub()
      const whereRawPc2 = sandbox.stub()
      const payerTransferStub = sandbox.stub()
      const payerRoleTypeStub = sandbox.stub()
      const payerCurrencyStub = sandbox.stub()
      const payerParticipantStub = sandbox.stub()
      const payeeTransferStub = sandbox.stub()
      const payeeRoleTypeStub = sandbox.stub()
      const payeeCurrencyStub = sandbox.stub()
      const payeeParticipantStub = sandbox.stub()
      const ilpPacketStub = sandbox.stub()
      const stateChangeStub = sandbox.stub()
      const transferFulfilmentStub = sandbox.stub()

      const selectStub = sandbox.stub()
      const orderByStub = sandbox.stub()

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
      transferExtensionModel.getByTransferId.returns(extensions)

      const found = await TransferFacade.getAll()

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
      await TransferFacade.getAll()
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
      const extensions = cloneDeep(transferExtensions)
      const transfer = { transferId, extensionList: extensions }
      const transferParticipantRoleType = Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP
      const ledgerEntryType = Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE

      const builderStub = sandbox.stub()
      const transferStateChange = sandbox.stub()
      const selectStub = sandbox.stub()
      const orderByStub = sandbox.stub()
      const firstStub = sandbox.stub()

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

      const found = await TransferFacade.getTransferInfoToChangePosition(transferId, transferParticipantRoleType, ledgerEntryType)
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
      await TransferFacade.getTransferInfoToChangePosition(transferId)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getTransferInfoToChangePosition failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await transferFacadeTest.test('savePayeeTransferResponse should', async savePayeeTransferResponse => {
    try {
      const transferId = Uuid()
      const extensions = cloneDeep(transferExtensions)
      const payload = {
        fulfilment: 'fulfilment.helper',
        completedTimestamp: now,
        extensionList: {
          extension: extensions
        }
      }
      let action = null
      const stateReason = null
      const savePayeeTransferResponseExecuted = true
      const transferFulfilmentRecord = { transferId, ilpFulfilment: 'fulfilment.helper', completedDate: Time.getUTCString(now), isValid: true, createdDate: Time.getUTCString(now), settlementWindowId: 1 }
      const transferStateChangeRecord = { transferId, transferStateId: 'state', reason: stateReason, createdDate: Time.getUTCString(now) }
      const transferExtensionRecords = extensions.map(ext => {
        return {
          transferId: transferFulfilmentRecord.transferId,
          isFulfilment: true,
          isError: false,
          key: ext.key,
          value: ext.value
        }
      })
      const savePayeeTransferResponseResult = { savePayeeTransferResponseExecuted, transferFulfilmentRecord, transferStateChangeRecord, transferExtensionRecordsList: transferExtensionRecords }

      await savePayeeTransferResponse.test('return transfer in RECEIVED_FULFIL state', async (test) => {
        try {
          action = TransferEventAction.COMMIT
          const record = [{ settlementWindowId: 1 }]
          transferStateChangeRecord.transferStateId = Enum.Transfers.TransferInternalState.RECEIVED_FULFIL
          const fspiopError = null

          sandbox.stub(Db, 'getKnex')
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          const builderStub = sandbox.stub()
          const selectStub = sandbox.stub()
          const whereStub = sandbox.stub()
          const orderByStub = sandbox.stub()
          const firstStub = sandbox.stub()

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

          const response = await TransferFacade.savePayeeTransferResponse(transferId, payload, action, fspiopError)
          test.deepEqual(response, savePayeeTransferResponseResult, 'response matches expected result')
          test.ok(knexStub.withArgs('transferFulfilment').calledOnce, 'knex called with transferFulfilment once')
          test.ok(knexStub.withArgs('transferExtension').calledTwice, 'knex called with transferExtension twice')
          test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange once')
          test.ok(transactingStub.withArgs(trxStub).called, 'knex.transacting called with trx')
          test.ok(insertStub.withArgs(transferFulfilmentRecord).calledOnce, 'insert transferFulfilmentRecord called once')
          for (const extension of transferExtensionRecords) {
            test.ok(insertStub.withArgs(extension).calledOnce, `insert transferExtension called once with ${JSON.stringify(extension)}`)
          }
          test.ok(insertStub.withArgs(transferStateChangeRecord).calledOnce, 'insert transferStateChangeRecord called once')
          test.end()
        } catch (err) {
          Logger.error(`savePayeeTransferResponse failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await savePayeeTransferResponse.test('return transfer in RECEIVED_REJECT state', async (test) => {
        try {
          action = TransferEventAction.REJECT
          const record = [{ settlementWindowId: 1 }]
          transferStateChangeRecord.transferStateId = Enum.Transfers.TransferInternalState.RECEIVED_REJECT
          const payload2 = cloneDeep(payload)
          delete payload2.completedTimestamp
          delete payload2.extensionList
          const fspiopError = {
            errorInformation: {
              errorCode: 1000,
              errorDescription: 'descr'
            }
          }

          sandbox.stub(Db, 'getKnex')
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          const builderStub = sandbox.stub()
          const selectStub = sandbox.stub()
          const whereStub = sandbox.stub()
          const orderByStub = sandbox.stub()
          const firstStub = sandbox.stub()

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

          const insertedTransferStateChange = cloneDeep(transferStateChangeRecord)
          insertedTransferStateChange.transferStateChangeId = 1
          const transactingStub = sandbox.stub()
          const insertStub = sandbox.stub()
          knexStub.returns({
            transacting: transactingStub.returns({
              insert: insertStub,
              where: whereStub.returns({
                forUpdate: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    orderBy: sandbox.stub().returns(insertedTransferStateChange)
                  })
                })
              })
            })
          })

          const expected = cloneDeep(savePayeeTransferResponseResult)
          delete expected.transferExtensionRecordsList
          expected.transferErrorRecord = {
            createdDate: insertedTransferStateChange.createdDate,
            errorCode: fspiopError.errorInformation.errorCode,
            errorDescription: fspiopError.errorInformation.errorDescription,
            transferId,
            transferStateChangeId: insertedTransferStateChange.transferStateChangeId
          }
          expected.transferFulfilmentRecord.isValid = false
          expected.transferFulfilmentRecord.settlementWindowId = null
          expected.transferStateChangeRecord.reason = fspiopError.errorInformation.errorDescription
          expected.transferStateChangeRecord.transferStateChangeId = insertedTransferStateChange.transferStateChangeId

          const response = await TransferFacade.savePayeeTransferResponse(transferId, payload2, action, fspiopError)
          test.deepEqual(response, expected, 'response matches expected result')
          test.ok(knexStub.withArgs('transferFulfilment').calledOnce, 'knex called with transferFulfilment once')
          test.ok(knexStub.withArgs('transferExtension').notCalled, 'knex not called with transferExtension')
          test.ok(knexStub.withArgs('transferStateChange').calledTwice, 'knex called with transferStateChange twice')
          test.ok(transactingStub.withArgs(trxStub).called, 'knex.transacting called with trx')
          test.ok(insertStub.withArgs(transferFulfilmentRecord).notCalled, 'insert transferFulfilmentRecord not called')
          test.ok(insertStub.withArgs(transferStateChangeRecord).notCalled, 'insert transferStateChangeRecord not called')
          test.end()
        } catch (err) {
          Logger.error(`savePayeeTransferResponse failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await savePayeeTransferResponse.test('return transfer in RECEIVED_ERROR state', async (test) => {
        try {
          action = TransferEventAction.BULK_ABORT
          const record = [{ settlementWindowId: 1 }]
          transferStateChangeRecord.transferStateId = Enum.Transfers.TransferInternalState.RECEIVED_ERROR
          const fspiopError = {
            errorInformation: {
              errorCode: 1000,
              errorDescription: 'descr'
            }
          }
          const payload2 = cloneDeep(fspiopError)

          sandbox.stub(Db, 'getKnex')
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          const builderStub = sandbox.stub()
          const selectStub = sandbox.stub()
          const whereStub = sandbox.stub()
          const orderByStub = sandbox.stub()
          const firstStub = sandbox.stub()

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

          const insertedTransferStateChange = cloneDeep(transferStateChangeRecord)
          insertedTransferStateChange.transferStateChangeId = 1
          const transactingStub = sandbox.stub()
          const insertStub = sandbox.stub()
          knexStub.returns({
            transacting: transactingStub.returns({
              insert: insertStub,
              where: whereStub.returns({
                forUpdate: sandbox.stub().returns({
                  first: sandbox.stub().returns({
                    orderBy: sandbox.stub().returns(insertedTransferStateChange)
                  })
                })
              })
            })
          })

          const expected = cloneDeep(savePayeeTransferResponseResult)
          delete expected.transferExtensionRecordsList
          delete expected.transferFulfilmentRecord
          expected.transferErrorRecord = {
            transferId,
            transferStateChangeId: insertedTransferStateChange.transferStateChangeId,
            errorCode: fspiopError.errorInformation.errorCode,
            errorDescription: fspiopError.errorInformation.errorDescription,
            createdDate: insertedTransferStateChange.createdDate
          }
          expected.transferStateChangeRecord.reason = fspiopError.errorInformation.errorDescription
          expected.transferStateChangeRecord.transferStateChangeId = insertedTransferStateChange.transferStateChangeId

          const response = await TransferFacade.savePayeeTransferResponse(transferId, payload2, action, fspiopError)
          test.deepEqual(response, expected, 'response matches expected result')
          test.ok(knexStub.withArgs('transferFulfilment').notCalled, 'knex not called with transferFulfilment')
          test.ok(knexStub.withArgs('transferExtension').notCalled, 'knex not called with transferExtension')
          test.ok(knexStub.withArgs('transferStateChange').calledTwice, 'knex called with transferStateChange twice')
          test.ok(transactingStub.withArgs(trxStub).called, 'knex.transacting called with trx')
          test.ok(insertStub.withArgs(transferFulfilmentRecord).notCalled, 'insert transferFulfilmentRecord not called')
          test.ok(insertStub.withArgs(transferStateChangeRecord).notCalled, 'insert transferStateChangeRecord not called')
          test.end()
        } catch (err) {
          Logger.error(`savePayeeTransferResponse failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await savePayeeTransferResponse.test('throw an error and rollback', async (test) => {
        try {
          action = TransferEventAction.ABORT
          transferStateChangeRecord.transferStateId = Enum.Transfers.TransferInternalState.RECEIVED_ERROR
          const payload = {
            errorInformation: {
              errorCode: 1000,
              errorDescription: 'descr'
            }
          }
          const fspiopError = null

          sandbox.stub(Db, 'getKnex')
          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)
          const transactingStub = sandbox.stub()
          knexStub.returns({
            transacting: transactingStub.returns({
              insert: sandbox.stub().throws(new Error('insert error'))
            })
          })

          await TransferFacade.savePayeeTransferResponse(transferId, payload, action, fspiopError)
          test.fail('Error not thrown')
          test.end()
        } catch (err) {
          Logger.error(`savePayeeTransferResponse failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await savePayeeTransferResponse.end()
    } catch (err) {
      Logger.error(`savePayeeTransferResponse failed with error - ${err}`)
      savePayeeTransferResponse.fail()
      await savePayeeTransferResponse.end()
    }
  })

  await transferFacadeTest.test('savePayeeTransferResponse should throw an error when action is not supported', async (test) => {
    try {
      const transferId = 't1'
      const payload = {}
      const action = 'not supported'
      const fspiopError = null
      await TransferFacade.savePayeeTransferResponse(transferId, payload, action, fspiopError)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`savePayeeTransferResponse failed with error - ${err}`)
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

      const result = await TransferFacade.saveTransferPrepared(payloadFixture, null, true)
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

      const result = await TransferFacade.saveTransferPrepared(payloadFixture)
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

      const result = await TransferFacade.saveTransferPrepared(payload, null, true)
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

  await transferFacadeTest.test('saveTransferPrepared rollback after validation passed but commit failed', async (test) => {
    try {
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp1', 'USD', 1).returns('dfsp1', 1)
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp2', 'USD', 1).returns('dfsp2', 2)

      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      knexStub.batchInsert = sandbox.stub().returns({ transacting: sandbox.stub().returns(1) })
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        transacting: sandbox.stub().returns({
          insert: sandbox.stub().throws(new Error())
        })
      })

      await TransferFacade.saveTransferPrepared(payloadFixture, null, true)
      test.fail(' should throw')
      test.end()
      test.end()
    } catch (err) {
      test.pass('Error thrown')
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
        insert: sandbox.stub().returns(1)
      })

      const result = await TransferFacade.saveTransferPrepared(payloadFixture, 'Invalid Payee', false)
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

  await transferFacadeTest.test('saveTransferPrepared save invalid prepared and log warn when subsequent inserts fail', async (test) => {
    try {
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp1', 'USD', 1).returns('dfsp1', 1)
      ParticipantFacade.getByNameAndCurrency.withArgs('dfsp2', 'USD', 1).returns('dfsp2', 2)

      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      knexStub.batchInsert = sandbox.stub().throws(new Error('batch insert failed'))
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        insert: sandbox.stub().throws(new Error('insert failed'))
      })
      knexStub.withArgs('transfer').returns({
        insert: sandbox.stub().returns(1)
      })

      const result = await TransferFacade.saveTransferPrepared(payloadFixture, 'Invalid Payee', false)
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

  await transferFacadeTest.test('saveTransferPrepared save invalid prepared transfer without extensions', async (test) => {
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
        insert: sandbox.stub().returns(1)
      })

      delete payloadFixture.extensionList
      const result = await TransferFacade.saveTransferPrepared(payloadFixture, 'Invalid Payee', false)
      test.equal(result, undefined, 'result matches expected result')
      test.ok(knexStub.withArgs('transfer').calledOnce, 'knex called with transfer once')
      test.ok(knexStub.withArgs('transferParticipant').calledTwice, 'knex called with transferParticipant twice')
      test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange once')
      test.ok(knexStub.batchInsert.withArgs('transferExtension').notCalled, 'knex was not called with transferExtension')
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

      await TransferFacade.saveTransferPrepared(payloadFixture, 'Invalid Payee', false)
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

      await TransferFacade.saveTransferPrepared(payloadFixture, 'Invalid Payee', false)
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
      const builderStub = sandbox.stub()
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

      const result = await TransferFacade.getTransferStateByTransferId(transferStateChange.transferId)
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
      await TransferFacade.getTransferStateByTransferId('id')
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

          await TransferFacade.timeoutExpireReserved(segmentId, intervalMin, intervalMax)
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
          const context = sandbox.stub()
          context.from = sandbox.stub().returns({
            innerJoin: sandbox.stub().returns({
              innerJoin: sandbox.stub().returns({
                leftJoin: sandbox.stub().returns({
                  whereNull: sandbox.stub().returns({
                    whereIn: sandbox.stub().returns({
                      select: sandbox.stub()
                    })
                  })
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
                            leftJoin: sandbox.stub().returns({
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
            result = await TransferFacade.timeoutExpireReserved(segmentId, intervalMin, intervalMax)
            test.equal(result, expectedResult, 'Expected result returned')
          } catch (err) {
            Logger.error(`timeoutExpireReserved failed with error - ${err}`)
            test.fail()
          }
          try {
            segmentId = 1
            await TransferFacade.timeoutExpireReserved(segmentId, intervalMin, intervalMax)
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

  await transferFacadeTest.test('transferStateAndPositionUpdate should', async transferStateAndPositionUpdateTest => {
    try {
      await transferStateAndPositionUpdateTest.test('throw error if database is not available', async test => {
        try {
          const param1 = {}
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub().throws(new Error('Database unavailable'))
          sandbox.stub(Db, 'getKnex').returns(knexStub)

          await TransferFacade.transferStateAndPositionUpdate(param1, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`transferStateAndPositionUpdate failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await transferStateAndPositionUpdateTest.test('change position when called from within a transaction', async test => {
        try {
          const param1 = {
            transferId: Uuid(),
            transferStateId: Enum.Transfers.TransferState.COMMITTED,
            reason: 'text',
            createdDate: Time.getUTCString(now),
            drUpdated: true,
            crUpdated: false
          }
          const infoDataStub = {
            drAccountId: 4,
            drAmount: -100,
            drPositionId: 4,
            drPositionValue: 0,
            drReservedValue: 0,
            crAccountId: 1,
            crAmount: 100,
            crPositionId: 1,
            crPositionValue: 0,
            crReservedValue: 0,
            transferStateId: Enum.Transfers.TransferState.COMMITTED,
            ledgerAccountTypeId: 2
          }
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.withArgs('transfer AS t').returns({
            join: sandbox.stub().callsArgOn(1, context).returns({
              join: sandbox.stub().returns({
                join: sandbox.stub().returns({
                  join: sandbox.stub().callsArgOn(1, context).returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: sandbox.stub().returns({
                          where: sandbox.stub().returns({
                            whereIn: sandbox.stub().returns({
                              whereIn: sandbox.stub().returns({
                                select: sandbox.stub().returns({
                                  orderBy: sandbox.stub().returns({
                                    first: sandbox.stub().returns({
                                      transacting: sandbox.stub().returns(Promise.resolve(infoDataStub))
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
          knexStub.withArgs('transferStateChange').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(9)
            })
          })
          knexStub.withArgs('participantPosition').returns({
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantPositionChange').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })

          const expectedResult = {
            transferStateChangeId: 9,
            drPositionValue: new MLNumber(infoDataStub.drPositionValue).add(infoDataStub.drAmount).toFixed(Config.AMOUNT.SCALE),
            crPositionValue: new MLNumber(infoDataStub.crPositionValue).add(infoDataStub.crAmount).toFixed(Config.AMOUNT.SCALE)
          }
          let result = await TransferFacade.transferStateAndPositionUpdate(param1, enums, trxStub)
          test.deepEqual(result, expectedResult, 'Expected result is returned')
          test.equal(knexStub.withArgs('transferStateChange').callCount, 2)
          test.equal(knexStub.withArgs('participantPosition').callCount, 1)
          test.equal(knexStub.withArgs('participantPositionChange').callCount, 1)

          param1.drUpdated = false
          param1.crUpdated = true
          result = await TransferFacade.transferStateAndPositionUpdate(param1, enums, trxStub)
          test.deepEqual(result, expectedResult, 'Expected result is returned')
          test.equal(knexStub.withArgs('transferStateChange').callCount, 4)
          test.equal(knexStub.withArgs('participantPosition').callCount, 2)
          test.equal(knexStub.withArgs('participantPositionChange').callCount, 2)
          test.end()
        } catch (err) {
          Logger.error(`transferStateAndPositionUpdate failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await transferStateAndPositionUpdateTest.test('commit when called outside of a transaction', async test => {
        try {
          const param1 = {
            transferId: Uuid(),
            transferStateId: Enum.Transfers.TransferInternalState.ABORTED_REJECTED,
            reason: 'text',
            createdDate: Time.getUTCString(now),
            drUpdated: true,
            crUpdated: true
          }
          const infoDataStub = {
            drAccountId: 4,
            drAmount: -100,
            drPositionId: 4,
            drPositionValue: 0,
            drReservedValue: 0,
            crAccountId: 1,
            crAmount: 100,
            crPositionId: 1,
            crPositionValue: 0,
            crReservedValue: 0,
            transferStateId: Enum.Transfers.TransferInternalState.ABORTED_REJECTED,
            ledgerAccountTypeId: 2
          }
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.withArgs('transfer AS t').returns({
            join: sandbox.stub().callsArgOn(1, context).returns({
              join: sandbox.stub().returns({
                join: sandbox.stub().returns({
                  join: sandbox.stub().callsArgOn(1, context).returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: sandbox.stub().returns({
                          where: sandbox.stub().returns({
                            whereIn: sandbox.stub().returns({
                              whereIn: sandbox.stub().returns({
                                select: sandbox.stub().returns({
                                  orderBy: sandbox.stub().returns({
                                    first: sandbox.stub().returns({
                                      transacting: sandbox.stub().returns(Promise.resolve(infoDataStub))
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
          knexStub.withArgs('transferStateChange').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(9)
            })
          })
          knexStub.withArgs('participantPosition').returns({
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantPositionChange').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub()
            })
          })

          const expectedResult = {
            transferStateChangeId: 9,
            drPositionValue: new MLNumber(infoDataStub.drPositionValue).subtract(infoDataStub.drAmount).toFixed(Config.AMOUNT.SCALE),
            crPositionValue: new MLNumber(infoDataStub.crPositionValue).subtract(infoDataStub.crAmount).toFixed(Config.AMOUNT.SCALE)
          }
          const result = await TransferFacade.transferStateAndPositionUpdate(param1, enums)
          test.deepEqual(result, expectedResult, 'Expected result is returned')
          test.equal(knexStub.withArgs('transferStateChange').callCount, 2)
          test.equal(knexStub.withArgs('participantPosition').callCount, 2)
          test.equal(knexStub.withArgs('participantPositionChange').callCount, 2)
          test.end()
        } catch (err) {
          Logger.error(`transferStateAndPositionUpdate failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await transferStateAndPositionUpdateTest.test('throw error and rollback when called outside of a transaction', async test => {
        try {
          const param1 = {
            transferId: Uuid(),
            transferStateId: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
            reason: 'text',
            createdDate: Time.getUTCString(now),
            drUpdated: true,
            crUpdated: false
          }
          const infoDataStub = {
            drAccountId: 4,
            drAmount: -100,
            drPositionId: 4,
            drPositionValue: 0,
            drReservedValue: 0,
            crAccountId: 1,
            crAmount: 100,
            crPositionId: 1,
            crPositionValue: 0,
            crReservedValue: 0,
            transferStateId: 'RECEIVED_PREPARE',
            ledgerAccountTypeId: 2
          }
          const trxStub = sandbox.stub()

          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          const context = sandbox.stub()
          context.on = sandbox.stub().returns({
            andOn: sandbox.stub()
          })
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          knexStub.withArgs('transfer AS t').returns({
            join: sandbox.stub().callsArgOn(1, context).returns({
              join: sandbox.stub().returns({
                join: sandbox.stub().returns({
                  join: sandbox.stub().callsArgOn(1, context).returns({
                    join: sandbox.stub().returns({
                      join: sandbox.stub().returns({
                        join: sandbox.stub().returns({
                          where: sandbox.stub().returns({
                            whereIn: sandbox.stub().returns({
                              whereIn: sandbox.stub().returns({
                                select: sandbox.stub().returns({
                                  orderBy: sandbox.stub().returns({
                                    first: sandbox.stub().returns({
                                      transacting: sandbox.stub().returns(Promise.resolve(infoDataStub))
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
          knexStub.withArgs('transferStateChange').returns({
            insert: sandbox.stub().returns({
              transacting: sandbox.stub().returns(9)
            })
          })
          knexStub.withArgs('participantPosition').returns({
            update: sandbox.stub().returns({
              where: sandbox.stub().returns({
                transacting: sandbox.stub()
              })
            })
          })
          knexStub.withArgs('participantPositionChange').returns({
            insert: sandbox.stub().throws(new Error('Insert failed'))
          })

          await TransferFacade.transferStateAndPositionUpdate(param1, enums)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`transferStateAndPositionUpdate failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await transferStateAndPositionUpdateTest.end()
    } catch (err) {
      Logger.error(`transferFacadeTest failed with error - ${err}`)
      transferStateAndPositionUpdateTest.fail()
      transferStateAndPositionUpdateTest.end()
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

          await TransferFacade.reconciliationTransferPrepare(payload, transactionTimestamp, enums, trxStub)
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
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_PREPARE_RESERVE,
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
          sandbox.stub(TransferFacade, 'reconciliationTransferAbort')

          const result = await TransferFacade.reconciliationTransferPrepare(payload, transactionTimestamp, enums, trxStub)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub.withArgs('transfer').callCount, 1)
          test.equal(knexStub.withArgs('participantCurrency').callCount, 1)
          test.equal(knexStub.withArgs('transferParticipant').callCount, 2)
          test.equal(knexStub.withArgs('transferStateChange').callCount, 1)
          test.equal(knexStub.withArgs('transferExtension').callCount, 3)
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
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_ABORT,
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
          await TransferFacade.reconciliationTransferPrepare(payload, transactionTimestamp, enums, trxStub)
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
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_IN,
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
          sandbox.stub(TransferFacade, 'reconciliationTransferAbort')

          const result = await TransferFacade.reconciliationTransferPrepare(payload, transactionTimestamp, enums)
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
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_PREPARE_RESERVE,
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
                      Promise.reject(new Error('An error occurred'))
                    )
                  })
                })
              })
            })
          })
          sandbox.stub(TransferFacade, 'reconciliationTransferAbort').throws(new Error('Reconciliation Transfer Abort Failure'))

          await TransferFacade.reconciliationTransferPrepare(payload, transactionTimestamp, enums)
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

  await transferFacadeTest.test('reconciliationTransferReserve should', async reconciliationTransferReserveTest => {
    try {
      await reconciliationTransferReserveTest.test('throw error if database is not available', async test => {
        try {
          const payload = {}
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub().throws(new Error('Database unavailable'))
          sandbox.stub(Db, 'getKnex').returns(knexStub)

          await TransferFacade.reconciliationTransferReserve(payload, transactionTimestamp, enums, trxStub)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferPrepare failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await reconciliationTransferReserveTest.test('reserve funds and abort when drPositionValue is gt 0', async test => {
        try {
          const payload = {
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_PREPARE_RESERVE
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          sandbox.stub(TransferFacade, 'transferStateAndPositionUpdate').returns({ drPositionValue: 100 })
          sandbox.stub(TransferFacade, 'reconciliationTransferAbort')

          const result = await TransferFacade.reconciliationTransferReserve(payload, transactionTimestamp, enums, trxStub)
          test.equal(result, 0, 'Result for successful operation is returned')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferPrepare failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await reconciliationTransferReserveTest.test('reserve funds and commit when called outside of a transaction', async test => {
        try {
          const payload = {
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_IN
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          sandbox.stub(TransferFacade, 'transferStateAndPositionUpdate').returns({ crPositionValue: -100 })
          sandbox.stub(TransferFacade, 'reconciliationTransferAbort')

          const result = await TransferFacade.reconciliationTransferReserve(payload, transactionTimestamp, enums)
          test.equal(result, 0, 'Result for successful operation is returned')
          test.end()
        } catch (err) {
          Logger.error(`reconciliationTransferPrepare failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await reconciliationTransferReserveTest.test('rollback when called outside of a transaction and error occurs', async test => {
        try {
          const payload = {
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_IN
          }
          const transactionTimestamp = Time.getUTCString(now)

          const trxStub = sandbox.stub()
          const knexStub = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          sandbox.stub(Db, 'getKnex').returns(knexStub)
          sandbox.stub(TransferFacade, 'transferStateAndPositionUpdate').throws(new Error('transferStateAndPositionUpdate failed'))

          const result = await TransferFacade.reconciliationTransferReserve(payload, transactionTimestamp, enums)
          test.equal(result, 0, 'Result for successful operation is returned')
          test.fail('Error not thrown!')
        } catch (err) {
          Logger.error(`reconciliationTransferPrepare failed with error - ${err}`)
          test.ok('Error thrown as expected')
          test.end()
        }
      })

      await reconciliationTransferReserveTest.end()
    } catch (err) {
      Logger.error(`transferFacadeTest failed with error - ${err}`)
      reconciliationTransferReserveTest.fail()
      reconciliationTransferReserveTest.end()
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

          await TransferFacade.reconciliationTransferCommit(payload, transactionTimestamp, enums, trxStub)
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
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_COMMIT,
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
          sandbox.stub(TransferFacade, 'transferStateAndPositionUpdate')

          const result = await TransferFacade.reconciliationTransferCommit(payload, transactionTimestamp, enums, trxStub)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub().insert.callCount, 2)
          test.equal(TransferFacade.transferStateAndPositionUpdate.callCount, 1)
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
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_COMMIT,
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
          sandbox.stub(TransferFacade, 'transferStateAndPositionUpdate')

          await TransferFacade.reconciliationTransferCommit(payload, transactionTimestamp, enums, trxStub)
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
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_IN,
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
          sandbox.stub(TransferFacade, 'transferStateAndPositionUpdate')

          const result = await TransferFacade.reconciliationTransferCommit(payload, transactionTimestamp, enums)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub().insert.callCount, 2)
          test.equal(TransferFacade.transferStateAndPositionUpdate.callCount, 1)
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
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_ABORT,
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

          await TransferFacade.reconciliationTransferCommit(payload, transactionTimestamp, enums)
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

          await TransferFacade.reconciliationTransferAbort(payload, transactionTimestamp, enums, trxStub)
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
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_ABORT,
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
          sandbox.stub(TransferFacade, 'transferStateAndPositionUpdate')

          const result = await TransferFacade.reconciliationTransferAbort(payload, transactionTimestamp, enums, trxStub)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub().insert.callCount, 2)
          test.equal(TransferFacade.transferStateAndPositionUpdate.callCount, 1)
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
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_ABORT,
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

          await TransferFacade.reconciliationTransferAbort(payload, transactionTimestamp, enums, trxStub)
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
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_ABORT,
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
          sandbox.stub(TransferFacade, 'transferStateAndPositionUpdate')

          const result = await TransferFacade.reconciliationTransferAbort(payload, transactionTimestamp, enums)
          test.equal(result, 0, 'Result for successful operation returned')
          test.equal(knexStub().insert.callCount, 2)
          test.equal(TransferFacade.transferStateAndPositionUpdate.callCount, 1)
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
            action: Enum.Transfers.AdminTransferAction.RECORD_FUNDS_IN,
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

          await TransferFacade.reconciliationTransferAbort(payload, transactionTimestamp, enums)
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

  await transferFacadeTest.test('getTransferParticipant should', async (test) => {
    try {
      const participantName = 'fsp1'
      const transferId = '88416f4c-68a3-4819-b8e0-c23b27267cd5'
      const builderStub = sandbox.stub()
      const participantCurrencyStub = sandbox.stub()
      const transferParticipantStub = sandbox.stub()
      const selectStub = sandbox.stub()

      builderStub.where = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)

      builderStub.where.returns({
        innerJoin: participantCurrencyStub.returns({
          innerJoin: transferParticipantStub.returns({
            select: selectStub.returns([1])
          })
        })
      })

      const found = await TransferFacade.getTransferParticipant(participantName, transferId)
      test.deepEqual(found, [1], 'retrieve the record')
      test.ok(builderStub.where.withArgs({
        'participant.name': participantName,
        'tp.transferId': transferId,
        'participant.isActive': 1,
        'pc.isActive': 1
      }).calledOnce, 'query builder called once')
      test.ok(participantCurrencyStub.withArgs('participantCurrency AS pc', 'pc.participantId', 'participant.participantId').calledOnce, 'participantCurrency inner joined')
      test.ok(transferParticipantStub.withArgs('transferParticipant AS tp', 'tp.participantCurrencyId', 'pc.participantCurrencyId').calledOnce, 'transferParticipant inner joined')
      test.ok(selectStub.withArgs(
        'tp.*'
      ).calledOnce, 'select all columns from transferParticipant')
      test.end()
    } catch (err) {
      Logger.error(`getTransferParticipant failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await transferFacadeTest.test('getTransferParticipant should throw error', async (test) => {
    const participantName = 'fsp1'
    const transferId = '88416f4c-68a3-4819-b8e0-c23b27267cd5'
    const ledgerAccountTypeId = 1
    Db.participant.query.throws(new Error())
    try {
      await TransferFacade.getTransferParticipant(participantName, ledgerAccountTypeId, transferId)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getTransferParticipant failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await transferFacadeTest.end()
})
