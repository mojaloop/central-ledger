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

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const ModelParticipant = require('../../../../src/models/participant/facade')
const ModelPosition = require('../../../../src/models/position/facade')
const SettlementModelCached = require('../../../../src/models/settlement/settlementModelCached')
const Enum = require('@mojaloop/central-services-shared').Enum

Test('Position facade', async (positionFacadeTest) => {
  let sandbox
  let clock
  const now = new Date()

  positionFacadeTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.participant = {
      query: sandbox.stub()
    }
    clock = Sinon.useFakeTimers(now.getTime())

    Db.participantPosition = {
      query: sandbox.stub()
    }

    Db.from = (table) => {
      return Db[table]
    }

    t.end()
  })

  positionFacadeTest.afterEach(t => {
    sandbox.restore()
    clock.restore()
    t.end()
  })

  await positionFacadeTest.test('getParticipantPositionByParticipantIdAndCurrencyId should', async (test) => {
    try {
      const participantId = 1
      const currencyId = 'USD'
      const ledgerAccountTypeId = 1
      const builderStub = sandbox.stub()
      const participantCurrencyStub = sandbox.stub()
      const participantPositionStub = sandbox.stub()
      const selectStub = sandbox.stub()

      builderStub.where = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)

      builderStub.where.returns({
        innerJoin: participantCurrencyStub.returns({
          innerJoin: participantPositionStub.returns({
            select: selectStub.returns(1)
          })
        })
      })

      const found = await ModelParticipant.getParticipantPositionByParticipantIdAndCurrencyId(participantId, currencyId, ledgerAccountTypeId)
      test.equal(found, 1, 'retrieve the record')
      test.ok(builderStub.where.withArgs({
        'participant.participantId': participantId,
        'pc.currencyId': currencyId,
        'pc.ledgerAccountTypeId': ledgerAccountTypeId
      }).calledOnce, 'query builder called once')
      test.ok(participantCurrencyStub.withArgs('participantCurrency AS pc', 'pc.participantId', 'participant.participantId').calledOnce, 'participantCurrency inner joined')
      test.ok(participantPositionStub.withArgs('participantPosition AS pp', 'pp.participantCurrencyId', 'pc.participantCurrencyId').calledOnce, 'participantPosition inner joined')
      test.ok(selectStub.withArgs(
        'participant.*',
        'pc.*',
        'pp.*'
      ).calledOnce, 'select all columns from participant, participantCurrency and participantPosition')
      test.end()
    } catch (err) {
      Logger.error(`getParticipantPositionByParticipantIdAndCurrencyId failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionFacadeTest.test('getParticipantPositionByParticipantIdAndCurrencyId should', async (test) => {
    try {
      const participantId = 1
      const currencyId = 'USD'
      const ledgerAccountTypeId = 1
      Db.participant.query.throws(new Error())

      await ModelParticipant.getParticipantPositionByParticipantIdAndCurrencyId(participantId, currencyId, ledgerAccountTypeId)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getParticipantPositionByParticipantIdAndCurrencyId failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await positionFacadeTest.test('getParticipantLimitByParticipantIdAndCurrencyId should', async (test) => {
    try {
      const participantId = 1
      const currencyId = 'USD'
      const ledgerAccountTypeId = 1
      const builderStub = sandbox.stub()
      const participantCurrencyStub = sandbox.stub()
      const participantLimitStub = sandbox.stub()
      const selectStub = sandbox.stub()

      builderStub.where = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)

      builderStub.where.returns({
        innerJoin: participantCurrencyStub.returns({
          innerJoin: participantLimitStub.returns({
            select: selectStub.returns(1)
          })
        })
      })

      const found = await ModelParticipant.getParticipantLimitByParticipantIdAndCurrencyId(participantId, currencyId, ledgerAccountTypeId)
      test.equal(found, 1, 'retrieve the record')
      test.ok(builderStub.where.withArgs({
        'participant.participantId': participantId,
        'pc.currencyId': currencyId,
        'pc.ledgerAccountTypeId': ledgerAccountTypeId
      }).calledOnce, 'query builder called once')
      test.ok(participantCurrencyStub.withArgs('participantCurrency AS pc', 'pc.participantId', 'participant.participantId').calledOnce, 'participantCurrency inner joined')
      test.ok(participantLimitStub.withArgs('participantLimit AS pl', 'pl.participantCurrencyId', 'pc.participantCurrencyId').calledOnce, 'participantLimit inner joined')
      test.ok(selectStub.withArgs(
        'participant.*',
        'pc.*',
        'pl.*'
      ).calledOnce, 'select all columns from participant, participantCurrency and participantLimit')
      test.end()
    } catch (err) {
      Logger.error(`getParticipantLimitByParticipantIdAndCurrencyId failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionFacadeTest.test('getParticipantLimitByParticipantIdAndCurrencyId should', async (test) => {
    try {
      const participantId = 1
      const currencyId = 'USD'
      const ledgerAccountTypeId = 1
      Db.participant.query.throws(new Error())

      await ModelParticipant.getParticipantLimitByParticipantIdAndCurrencyId(participantId, currencyId, ledgerAccountTypeId)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getParticipantLimitByParticipantIdAndCurrencyId failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await positionFacadeTest.test('prepareChangeParticipantPositionTransaction should', async prepareChangeParticipantPositionTransaction => {
    try {
      const transfer = {
        transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2',
        amount: {
          currency: 'USD',
          amount: '100'
        },
        ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
        condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
        expiration: '2016-05-24T08:38:08.699-04:00',
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

      const messageProtocol = {
        id: transfer.transferId,
        from: transfer.payerFsp,
        to: transfer.payeeFsp,
        type: 'application/json',
        content: {
          header: '',
          payload: transfer
        },
        metadata: {
          event: {
            id: 't1',
            type: 'prepare',
            action: 'prepare',
            createdAt: new Date(),
            state: {
              status: 'success',
              code: 0
            }
          }
        },
        pp: ''
      }
      const transferStateChange = {
        transferId: 't1',
        transferStateId: Enum.Transfers.TransferInternalState.RECEIVED_PREPARE,
        reason: null,
        createdDate: now
      }

      const incorrectTransferStateChange = {
        transferId: 't1',
        transferStateId: 'EXPIRED',
        reason: null,
        createdDate: now
      }

      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 10000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        thresholdAlarmPercentage: 0.5
      }

      const initialParticipantPositions = [{
        participantPositionId: 1,
        participantCurrencyId: 1,
        value: 1000,
        reservedValue: 0
      },
      {
        participantPositionId: 2,
        participantCurrencyId: 2,
        value: 1000,
        reservedValue: 0
      }]

      const exceededParticipantPositions = [{
        participantPositionId: 1,
        participantCurrencyId: 1,
        value: 10000,
        reservedValue: 0
      },
      {
        participantPositionId: 2,
        participantCurrencyId: 2,
        value: 1000,
        reservedValue: 0
      }]

      await prepareChangeParticipantPositionTransaction.test('adjust position of payer when transfer is RESERVED', async test => {
        // const listOfTransferStatesChanged = [transferStateChange, incorrectTransferStateChange]
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()

          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          knexStub.batchInsert = sandbox.stub()
          knexStub.batchInsert.returns({
            transacting: sandbox.stub().resolves([1])
          })

          Db.getKnex.returns(knexStub)
          knexStub.returns({
            transacting: sandbox.stub().returns({
              forUpdate: sandbox.stub().returns({
                whereIn: sandbox.stub().returns({
                  select: sandbox.stub().returns(Promise.resolve())
                })
              }),
              where: sandbox.stub().returns({
                update: sandbox.stub().returns(Promise.resolve()),
                orderBy: sandbox.stub().returns({
                  first: sandbox.stub().resolves(Object.assign({}, transferStateChange))
                })
              }),
              whereIn: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns({
                  select: sandbox.stub().returns(initialParticipantPositions)
                })
              })
            })
          })

          sandbox.stub(ModelParticipant, 'getParticipantLimitByParticipantCurrencyLimit').returns(Promise.resolve(participantLimit))
          const getByNameAndCurrencyStub = sandbox.stub(ModelParticipant, 'getByNameAndCurrency')
          getByNameAndCurrencyStub.withArgs('dfsp1', 'USD', 1).resolves({
            participantCurrencyId: 1,
            participantId: 1,
            currencyId: 'USD',
            isActive: 1
          })
          getByNameAndCurrencyStub.withArgs('dfsp1', 'USD', 2).resolves({
            participantCurrencyId: 2,
            participantId: 1,
            currencyId: 'USD',
            isActive: 1
          })
          sandbox.stub(SettlementModelCached, 'getByLedgerAccountTypeId').resolves({
            settlementDelayId: Enum.Settlements.SettlementDelay.DEFERRED,
            settlementAccountTypeId: Enum.Accounts.LedgerAccountType.SETTLEMENT
          })
          const { preparedMessagesList, limitAlarms } = await ModelPosition.prepareChangeParticipantPositionTransaction([{ value: messageProtocol }])
          test.ok(Array.isArray(preparedMessagesList), 'array of prepared transfers is returned')
          test.ok(Array.isArray(limitAlarms), 'array of limit alarms is returned')
          test.ok(knexStub.withArgs('participantPosition').calledThrice, 'knex called with participantPosition twice')
          test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange twice')
          test.ok(knexStub.withArgs('transfer').calledOnce, 'knex called with transferStateChange twice')
          test.pass('completed successfully')
          test.end()
        } catch (err) {
          Logger.error(`prepareChangeParticipantPositionTransaction failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await prepareChangeParticipantPositionTransaction.test('abort transfer if state is not correct ', async test => {
        // const listOfTransferStatesChanged = [transferStateChange, incorrectTransferStateChange]
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()

          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          knexStub.batchInsert = sandbox.stub()
          knexStub.batchInsert.returns({
            transacting: sandbox.stub().resolves([1])
          })

          Db.getKnex.returns(knexStub)
          knexStub.returns({
            transacting: sandbox.stub().returns({
              forUpdate: sandbox.stub().returns({
                whereIn: sandbox.stub().returns({
                  select: sandbox.stub().returns(Promise.resolve())
                })
              }),
              where: sandbox.stub().returns({
                update: sandbox.stub().returns(Promise.resolve()),
                orderBy: sandbox.stub().returns({
                  first: sandbox.stub().resolves(incorrectTransferStateChange)
                })
              }),
              whereIn: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns({
                  select: sandbox.stub().returns(initialParticipantPositions)
                })
              })
            })
          })

          sandbox.stub(ModelParticipant, 'getParticipantLimitByParticipantCurrencyLimit').returns(Promise.resolve(participantLimit))
          const getByNameAndCurrencyStub = sandbox.stub(ModelParticipant, 'getByNameAndCurrency')
          getByNameAndCurrencyStub.withArgs('dfsp1', 'USD', 1).resolves({
            participantCurrencyId: 1,
            participantId: 1,
            currencyId: 'USD',
            isActive: 1
          })
          getByNameAndCurrencyStub.withArgs('dfsp1', 'USD', 2).resolves({
            participantCurrencyId: 2,
            participantId: 1,
            currencyId: 'USD',
            isActive: 1
          })
          sandbox.stub(SettlementModelCached, 'getByLedgerAccountTypeId').resolves({
            settlementDelayId: Enum.Settlements.SettlementDelay.DEFERRED,
            settlementAccountTypeId: Enum.Accounts.LedgerAccountType.SETTLEMENT
          })
          const { preparedMessagesList, limitAlarms } = await ModelPosition.prepareChangeParticipantPositionTransaction([{ value: messageProtocol }])
          test.ok(Array.isArray(preparedMessagesList), 'array of prepared transfers is returned')
          test.ok(Array.isArray(limitAlarms), 'array of limit alarms is returned')
          test.ok(knexStub.withArgs('participantPosition').calledThrice, 'knex called with participantPosition twice')
          test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange twice')
          test.ok(knexStub.withArgs('transfer').calledOnce, 'knex called with transferStateChange twice')
          test.pass('completed successfully')
          test.end()
        } catch (err) {
          Logger.error(`prepareChangeParticipantPositionTransaction failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await prepareChangeParticipantPositionTransaction.test('throw and rollback', async test => {
        // const listOfTransferStatesChanged = [transferStateChange, incorrectTransferStateChange]
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.rollback = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          knexStub.throws(new Error())

          await ModelPosition.prepareChangeParticipantPositionTransaction([{ value: messageProtocol }])
          test.fail('error not thrown')
          test.end()
        } catch (err) {
          Logger.error(`prepareChangeParticipantPositionTransaction failed with error - ${err}`)
          test.ok('error thrown')
          test.end()
        }
      })

      await prepareChangeParticipantPositionTransaction.test('abort transfer if net-debit-cap is exceeded ', async test => {
        // const listOfTransferStatesChanged = [transferStateChange, incorrectTransferStateChange]
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()

          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)

          knexStub.batchInsert = sandbox.stub()
          knexStub.batchInsert.returns({
            transacting: sandbox.stub().resolves([1])
          })

          Db.getKnex.returns(knexStub)
          knexStub.returns({
            transacting: sandbox.stub().returns({
              forUpdate: sandbox.stub().returns({
                whereIn: sandbox.stub().returns({
                  select: sandbox.stub().returns(Promise.resolve())
                })
              }),
              where: sandbox.stub().returns({
                update: sandbox.stub().returns(Promise.resolve()),
                orderBy: sandbox.stub().returns({
                  first: sandbox.stub().resolves(transferStateChange)
                })
              }),
              whereIn: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns({
                  select: sandbox.stub().returns(exceededParticipantPositions)
                })
              })
            })
          })

          sandbox.stub(ModelParticipant, 'getParticipantLimitByParticipantCurrencyLimit').returns(Promise.resolve(participantLimit))
          const getByNameAndCurrencyStub = sandbox.stub(ModelParticipant, 'getByNameAndCurrency')
          getByNameAndCurrencyStub.withArgs('dfsp1', 'USD', 1).resolves({
            participantCurrencyId: 1,
            participantId: 1,
            currencyId: 'USD',
            isActive: 1
          })
          getByNameAndCurrencyStub.withArgs('dfsp1', 'USD', 2).resolves({
            participantCurrencyId: 2,
            participantId: 1,
            currencyId: 'USD',
            isActive: 1
          })
          sandbox.stub(SettlementModelCached, 'getByLedgerAccountTypeId').resolves({
            settlementDelayId: Enum.Settlements.SettlementDelay.DEFERRED,
            settlementAccountTypeId: Enum.Accounts.LedgerAccountType.SETTLEMENT
          })
          const { preparedMessagesList, limitAlarms } = await ModelPosition.prepareChangeParticipantPositionTransaction([{ value: messageProtocol }])
          test.ok(Array.isArray(preparedMessagesList), 'array of prepared transfers is returned')
          test.ok(Array.isArray(limitAlarms), 'array of limit alarms is returned')
          test.ok(knexStub.withArgs('participantPosition').calledThrice, 'knex called with participantPosition twice')
          test.ok(knexStub.withArgs('transferStateChange').calledOnce, 'knex called with transferStateChange twice')
          test.ok(knexStub.withArgs('transfer').calledOnce, 'knex called with transferStateChange twice')
          test.pass('completed successfully')
          test.end()
        } catch (err) {
          Logger.error(`prepareChangeParticipantPositionTransaction failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await prepareChangeParticipantPositionTransaction.end()
    } catch (err) {
      Logger.error(`prepareChangeParticipantPositionTransaction failed with error - ${err}`)
      prepareChangeParticipantPositionTransaction.fail()
      prepareChangeParticipantPositionTransaction.end()
    }
  })

  await positionFacadeTest.test('changeParticipantPositionTransaction should', async changeParticipantPositionTransaction => {
    try {
      const participantCurrencyId = 'USD'
      let isIncrease
      const amount = 100
      const transferStateChange = {
        transferId: 't1',
        transferStateId: 'state',
        reason: null,
        createdDate: now
      }
      const participantPosition = {
        participantPositionId: 1,
        value: 1000,
        reservedValue: 0
      }
      const insertedTransferStateChange = {
        transferStateChangeId: 1
      }

      await changeParticipantPositionTransaction.test('use a transaction to update database when position is increasing', async (test) => {
        try {
          isIncrease = true
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          knexStub.returns({
            transacting: sandbox.stub().returns({
              where: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns({
                  select: sandbox.stub().returns({
                    first: sandbox.stub().returns(participantPosition)
                  }),
                  first: sandbox.stub().returns({
                    orderBy: sandbox.stub().returns(insertedTransferStateChange)
                  })
                }),
                update: sandbox.stub()
              }),
              insert: sandbox.stub()
            })
          })

          await ModelPosition.changeParticipantPositionTransaction(participantCurrencyId, isIncrease, amount, transferStateChange)
          test.pass('completed successfully')
          test.ok(knexStub.withArgs('participantPosition').calledTwice, 'knex called with participantPosition twice')
          test.ok(knexStub.withArgs('transferStateChange').calledTwice, 'knex called with transferStateChange twice')
          test.ok(knexStub.withArgs('participantPositionChange').calledOnce, 'knex called with participantPositionChange once')
          test.end()
        } catch (err) {
          Logger.error(`changeParticipantPositionTransaction failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await changeParticipantPositionTransaction.test('use a transaction to update database when position is decreasing', async (test) => {
        try {
          isIncrease = false

          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.commit = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          knexStub.returns({
            transacting: sandbox.stub().returns({
              where: sandbox.stub().returns({
                forUpdate: sandbox.stub().returns({
                  select: sandbox.stub().returns({
                    first: sandbox.stub().returns(participantPosition)
                  }),
                  first: sandbox.stub().returns({
                    orderBy: sandbox.stub().returns(insertedTransferStateChange)
                  })
                }),
                update: sandbox.stub()
              }),
              insert: sandbox.stub()
            })
          })

          await ModelPosition.changeParticipantPositionTransaction(participantCurrencyId, isIncrease, amount, transferStateChange)
          test.pass('completed successfully')
          test.ok(knexStub.withArgs('participantPosition').calledTwice, 'knex called with participantPosition twice')
          test.ok(knexStub.withArgs('transferStateChange').calledTwice, 'knex called with transferStateChange twice')
          test.ok(knexStub.withArgs('participantPositionChange').calledOnce, 'knex called with participantPositionChange once')
          test.end()
        } catch (err) {
          Logger.error(`changeParticipantPositionTransaction failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await changeParticipantPositionTransaction.test('rollback and throw error', async (test) => {
        try {
          sandbox.stub(Db, 'getKnex')
          const knexStub = sandbox.stub()
          const trxStub = sandbox.stub()
          trxStub.rollback = sandbox.stub()
          knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
          Db.getKnex.returns(knexStub)

          knexStub.throws(new Error())

          await ModelPosition.changeParticipantPositionTransaction(participantCurrencyId, isIncrease, amount, transferStateChange)
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          Logger.error(`changeParticipantPositionTransaction failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })

      await changeParticipantPositionTransaction.end()
    } catch (err) {
      Logger.error(`changeParticipantPositionTransaction failed with error - ${err}`)
      changeParticipantPositionTransaction.fail()
      await changeParticipantPositionTransaction.end()
    }
  })

  await positionFacadeTest.test('getByNameAndCurrency should return the participant position for given currency', async (test) => {
    try {
      const participantName = 'fsp1'
      const currencyId = 'USD'
      const ledgerAccountTypeId = 1
      const builderStub = sandbox.stub()

      const participantPosition = [
        {
          participantPositionId: 1,
          participantCurrencyId: 1,
          value: 1000,
          reservedValue: 0.0,
          changedDate: new Date()
        }
      ]

      builderStub.innerJoin = sandbox.stub()
      const whereStub = { where: sandbox.stub().returns() }
      Db.participantPosition.query.callsArgWith(0, builderStub)

      builderStub.innerJoin.returns({
        innerJoin: sandbox.stub().returns({
          where: sandbox.stub().returns({
            where: sandbox.stub().callsArgWith(0, whereStub).returns({
              select: sandbox.stub().returns(participantPosition)
            })
          })
        })
      })

      const found = await ModelPosition.getByNameAndCurrency(participantName, ledgerAccountTypeId, currencyId)
      test.deepEqual(found, participantPosition, 'retrieve the record')
      test.ok(builderStub.innerJoin.withArgs('participantCurrency AS pc', 'participantPosition.participantCurrencyId', 'pc.participantCurrencyId').calledOnce, 'query builder called once')

      test.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionFacadeTest.test('getByNameAndCurrency should return the participant positions for all currencies', async (test) => {
    try {
      const participantName = 'fsp1'
      const ledgerAccountTypeId = 1
      const builderStub = sandbox.stub()

      const participantPosition = [
        {
          participantPositionId: 1,
          participantCurrencyId: 1,
          value: 1000,
          reservedValue: 0.0,
          changedDate: new Date()
        },
        {
          participantPositionId: 2,
          participantCurrencyId: 3,
          value: 2000,
          reservedValue: 0.0,
          changedDate: new Date()
        }
      ]

      builderStub.innerJoin = sandbox.stub()
      const whereStub = { where: sandbox.stub().returns() }
      Db.participantPosition.query.callsArgWith(0, builderStub)

      builderStub.innerJoin.returns({
        innerJoin: sandbox.stub().returns({
          where: sandbox.stub().returns({
            where: sandbox.stub().callsArgWith(0, whereStub).returns({
              select: sandbox.stub().returns(participantPosition)
            })
          })
        })
      })

      const found = await ModelPosition.getByNameAndCurrency(participantName, ledgerAccountTypeId)
      test.deepEqual(found, participantPosition, 'retrieve the record')
      test.ok(builderStub.innerJoin.withArgs('participantCurrency AS pc', 'participantPosition.participantCurrencyId', 'pc.participantCurrencyId').calledOnce, 'query builder called once')

      test.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionFacadeTest.test('getByNameAndCurrency should throw error', async (test) => {
    try {
      const participantName = 'fsp1'
      const currencyId = 'USD'
      const ledgerAccountTypeId = 1

      Db.participantPosition.query.throws(new Error())

      await ModelPosition.getByNameAndCurrency(participantName, currencyId, ledgerAccountTypeId)
      test.fail(' should throw')
      test.end()
      test.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await positionFacadeTest.test('getAllByNameAndCurrency should return the participant position for given currency', async (test) => {
    try {
      const participantName = 'fsp1'
      const currencyId = 'USD'
      const ledgerAccountTypeId = 1
      const builderStub = sandbox.stub()

      const participantPosition = [
        {
          participantPositionId: 1,
          participantCurrencyId: 1,
          value: 1000,
          reservedValue: 0.0,
          changedDate: new Date()
        }
      ]

      builderStub.innerJoin = sandbox.stub()
      const whereStub = { where: sandbox.stub().returns() }
      Db.participantPosition.query.callsArgWith(0, builderStub)

      builderStub.innerJoin.returns({
        innerJoin: sandbox.stub().returns({
          innerJoin: sandbox.stub().returns({
            where: sandbox.stub().returns({
              where: sandbox.stub().callsArgWith(0, whereStub).returns({
                select: sandbox.stub().returns(participantPosition)
              })
            })
          })
        })
      })

      const found = await ModelPosition.getAllByNameAndCurrency(participantName, currencyId, ledgerAccountTypeId)
      test.deepEqual(found, participantPosition, 'retrieve the record')
      test.ok(builderStub.innerJoin.withArgs('participantCurrency AS pc', 'participantPosition.participantCurrencyId', 'pc.participantCurrencyId').calledOnce, 'query builder called once')

      test.end()
    } catch (err) {
      Logger.error(`getAllByNameAndCurrency failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionFacadeTest.test('getAllByNameAndCurrency should return the participant positions for all currencies', async (test) => {
    try {
      const participantName = 'fsp1'
      const builderStub = sandbox.stub()

      const participantPosition = [
        {
          participantPositionId: 1,
          participantCurrencyId: 1,
          value: 1000,
          reservedValue: 0.0,
          changedDate: new Date()
        },
        {
          participantPositionId: 2,
          participantCurrencyId: 3,
          value: 2000,
          reservedValue: 0.0,
          changedDate: new Date()
        }
      ]

      builderStub.innerJoin = sandbox.stub()
      const whereStub = { where: sandbox.stub().returns() }
      Db.participantPosition.query.callsArgWith(0, builderStub)

      builderStub.innerJoin.returns({
        innerJoin: sandbox.stub().returns({
          innerJoin: sandbox.stub().returns({
            where: sandbox.stub().returns({
              where: sandbox.stub().callsArgWith(0, whereStub).returns({
                select: sandbox.stub().returns(participantPosition)
              })
            })
          })
        })
      })

      const found = await ModelPosition.getAllByNameAndCurrency(participantName)
      test.deepEqual(found, participantPosition, 'retrieve the record')
      test.ok(builderStub.innerJoin.withArgs('participantCurrency AS pc', 'participantPosition.participantCurrencyId', 'pc.participantCurrencyId').calledOnce, 'query builder called once')

      test.end()
    } catch (err) {
      Logger.error(`getAllByNameAndCurrency failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionFacadeTest.test('getAllByNameAndCurrency should throw error', async (test) => {
    try {
      const participantName = 'fsp1'
      const currencyId = 'USD'
      const ledgerAccountTypeId = 1

      Db.participantPosition.query.throws(new Error())

      await ModelPosition.getAllByNameAndCurrency(participantName, currencyId, ledgerAccountTypeId)
      test.fail(' should throw')
      test.end()
      test.end()
    } catch (err) {
      Logger.error(`getAllByNameAndCurrency failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await positionFacadeTest.end()
})
