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

// TODO

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const Model = require('../../../../src/models/transfer/facade')
const transferExtensionModel = require('../../../../src/models/transfer/transferExtension')

Test('Transfer model', async (transferTest) => {
  let sandbox

  const extensionsRecordList = [{key: 'key1', value: 'value1'}, {key: 'key2', value: 'value2'}]

  transferTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.transfer = {
      insert: sandbox.stub(),
      find: sandbox.stub(),
      update: sandbox.stub(),
      truncate: sandbox.stub(),
      query: sandbox.stub(),
      destroy: sandbox.stub()
    }
    t.end()
  })

  transferTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await transferTest.test('getById should return transfer by id', async (assert) => {
    try {
      const transferId1 = 't1'
      const transferId2 = 't2'
      const transfers = [{transferId: transferId1, extensionList: extensionsRecordList}, {transferId: transferId2}]

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
      transferExtensionModel.getByTransferId.returns(extensionsRecordList)

      let found = await Model.getById(transferId1)
      assert.equal(found, transfers[0])
      assert.ok(builderStub.where.withArgs({
        'transfer.transferId': transferId1,
        'tprt1.name': 'PAYER_DFSP',
        'tprt2.name': 'PAYEE_DFSP'
      }).calledOnce)
      assert.ok(whereRawPc1.withArgs('pc1.currencyId = transfer.currencyId').calledOnce)
      assert.ok(whereRawPc2.withArgs('pc2.currencyId = transfer.currencyId').calledOnce)
      assert.ok(payerTransferStub.withArgs('transferParticipant AS tp1', 'tp1.transferId', 'transfer.transferId').calledOnce)
      assert.ok(payerRoleTypeStub.withArgs('transferParticipantRoleType AS tprt1', 'tprt1.transferParticipantRoleTypeId', 'tp1.transferParticipantRoleTypeId').calledOnce)
      assert.ok(payerCurrencyStub.withArgs('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId').calledOnce)
      assert.ok(payerParticipantStub.withArgs('participant AS da', 'da.participantId', 'pc1.participantId').calledOnce)
      assert.ok(payeeTransferStub.withArgs('transferParticipant AS tp2', 'tp2.transferId', 'transfer.transferId').calledOnce)
      assert.ok(payeeRoleTypeStub.withArgs('transferParticipantRoleType AS tprt2', 'tprt2.transferParticipantRoleTypeId', 'tp2.transferParticipantRoleTypeId').calledOnce)
      assert.ok(payeeCurrencyStub.withArgs('participantCurrency AS pc2', 'pc2.participantCurrencyId', 'tp2.participantCurrencyId').calledOnce)
      assert.ok(payeeParticipantStub.withArgs('participant AS ca', 'ca.participantId', 'pc2.participantId').calledOnce)
      assert.ok(ilpPacketStub.withArgs('ilpPacket AS ilpp', 'ilpp.transferId', 'transfer.transferId').calledOnce)
      assert.ok(stateChangeStub.withArgs('transferStateChange AS tsc', 'tsc.transferId', 'transfer.transferId').calledOnce)
      assert.ok(transferFulfilmentStub.withArgs('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId').calledOnce)
      assert.ok(selectStub.withArgs(
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
      assert.ok(orderByStub.withArgs('tsc.transferStateChangeId', 'desc').calledOnce)
      assert.ok(firstStub.withArgs().calledOnce)
      assert.end()
    } catch (err) {
      Logger.error(`create transfer failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transferTest.test('getById should throw an error', async (assert) => {
    try {
      const transferId1 = 't1'
      Db.transfer.query.throws(new Error())
      await Model.getById(transferId1)
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      Logger.error(`create transfer failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await transferTest.test('getAll should return all transfers', async (assert) => {
    try {
      const transferId1 = 't1'
      const transferId2 = 't2'
      const transfers = [{transferId: transferId1, extensionList: extensionsRecordList}, {transferId: transferId2}]

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
      transferExtensionModel.getByTransferId.returns(extensionsRecordList)

      let found = await Model.getAll()

      assert.equal(found, transfers)
      assert.ok(builderStub.where.withArgs({
        'tprt1.name': 'PAYER_DFSP',
        'tprt2.name': 'PAYEE_DFSP'
      }).calledOnce)
      assert.ok(whereRawPc1.withArgs('pc1.currencyId = transfer.currencyId').calledOnce)
      assert.ok(whereRawPc2.withArgs('pc2.currencyId = transfer.currencyId').calledOnce)
      assert.ok(payerTransferStub.withArgs('transferParticipant AS tp1', 'tp1.transferId', 'transfer.transferId').calledOnce)
      assert.ok(payerRoleTypeStub.withArgs('transferParticipantRoleType AS tprt1', 'tprt1.transferParticipantRoleTypeId', 'tp1.transferParticipantRoleTypeId').calledOnce)
      assert.ok(payerCurrencyStub.withArgs('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId').calledOnce)
      assert.ok(payerParticipantStub.withArgs('participant AS da', 'da.participantId', 'pc1.participantId').calledOnce)
      assert.ok(payeeTransferStub.withArgs('transferParticipant AS tp2', 'tp2.transferId', 'transfer.transferId').calledOnce)
      assert.ok(payeeRoleTypeStub.withArgs('transferParticipantRoleType AS tprt2', 'tprt2.transferParticipantRoleTypeId', 'tp2.transferParticipantRoleTypeId').calledOnce)
      assert.ok(payeeCurrencyStub.withArgs('participantCurrency AS pc2', 'pc2.participantCurrencyId', 'tp2.participantCurrencyId').calledOnce)
      assert.ok(payeeParticipantStub.withArgs('participant AS ca', 'ca.participantId', 'pc2.participantId').calledOnce)
      assert.ok(ilpPacketStub.withArgs('ilpPacket AS ilpp', 'ilpp.transferId', 'transfer.transferId').calledOnce)
      assert.ok(stateChangeStub.withArgs('transferStateChange AS tsc', 'tsc.transferId', 'transfer.transferId').calledOnce)
      assert.ok(transferFulfilmentStub.withArgs('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId').calledOnce)
      assert.ok(selectStub.withArgs(
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
      assert.ok(orderByStub.withArgs('tsc.transferStateChangeId', 'desc').calledOnce)
      assert.end()
    } catch (err) {
      Logger.error(`create transfer failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transferTest.test('getAll should throw an error', async (assert) => {
    try {
      Db.transfer.query.throws(new Error())
      await Model.getAll()
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      Logger.error(`create transfer failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await transferTest.end()
})
