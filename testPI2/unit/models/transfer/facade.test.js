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

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const Model = require('../../../../src/models/transfer/facade')
const extensionModel = require('../../../../src/models/transfer/transferExtension')

Test('Transfer model', async (transferTest) => {
  let sandbox
  const extensionsRecordList = []

  await transferTest.test('setup', async (assert) => {
    sandbox = Sinon.createSandbox()
    Db.transfer = {
      query: sandbox.stub()
    }
    assert.pass('setup OK')
    assert.end()
  })

  // getById
  await transferTest.test('return transfer by id', async (assert) => {
    try {
      const transferId1 = 't1'
      const transferId2 = 't2'
      const transfers = [{transferId: transferId1}, {transferId: transferId2}]

      let builderStub = sandbox.stub()
      let payerStub = sandbox.stub()
      let payeeStub = sandbox.stub()
      let stateChangeStub = sandbox.stub()
      let ilpStub = sandbox.stub()
      let selectStub = sandbox.stub()
      let orderStub = sandbox.stub()
      let firstStub = sandbox.stub()

      builderStub.where = sandbox.stub()

      Db.transfer.query.callsArgWith(0, builderStub)
      Db.transfer.query.returns(transfers)

      builderStub.where.returns({
        innerJoin: payerStub.returns({
          innerJoin: payeeStub.returns({
            leftJoin: stateChangeStub.returns({
              leftJoin: ilpStub.returns({
                select: selectStub.returns({
                  orderBy: orderStub.returns({
                    first: firstStub.returns(transfers)
                  })
                })
              })
            })
          })
        })
      })

      sandbox.stub(extensionModel, 'getByTransferId')
      extensionModel.getByTransferId.returns(extensionsRecordList)

      let found = await Model.getById(transferId1)
      assert.equal(found, transfers)
      assert.ok(builderStub.where.withArgs({'transfer.transferId': transferId1}))
      assert.ok(payerStub.withArgs('participant AS ca', 'transfer.payerParticipantId', 'ca.participantId').calledOnce)
      assert.ok(payeeStub.withArgs('participant AS da', 'transfer.payeeParticipantId', 'da.participantId').calledOnce)
      assert.ok(stateChangeStub.withArgs('transferStateChange AS tsc', 'transfer.transferId', 'tsc.transferId').calledOnce)
      assert.ok(ilpStub.withArgs('ilp AS ilp', 'transfer.transferId', 'ilp.transferId').calledOnce)
      assert.ok(selectStub.withArgs(
        'transfer.*',
        'transfer.currencyId AS currency',
        'ca.name AS payerFsp',
        'da.name AS payeeFsp',
        'tsc.transferStateId AS transferState',
        'tsc.changedDate AS completedTimestamp',
        'ilp.packet AS ilpPacket',
        'ilp.condition AS condition',
        'ilp.fulfilment AS fulfilment',
        'ilp.ilpId AS ilpId'
      ).calledOnce)
      assert.ok(orderStub.withArgs('tsc.transferStateChangeId', 'desc').calledOnce)
      assert.ok(firstStub.withArgs().calledOnce)
      assert.end()
    } catch (err) {
      Logger.error(`query transfer failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transferTest.test('return transfer by id should throw an error', async (assert) => {
    try {
      const transferId1 = 't1'
      Db.transfer.query.throws(new Error())
      await Model.getById(transferId1)
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      Logger.error(`query transfer failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  // getAll
  await transferTest.test('return all transfers', async (assert) => {
    try {
      const transferId1 = 't1'
      const transferId2 = 't2'
      const transfers = [{transferId: transferId1}, {transferId: transferId2}]

      let builderStub = sandbox.stub()
      let payeeStub = sandbox.stub()
      let stateChangeStub = sandbox.stub()
      let stateStub = sandbox.stub()
      let ilpStub = sandbox.stub()
      let selectStub = sandbox.stub()
      let orderStub = sandbox.stub()

      builderStub.innerJoin = sandbox.stub()

      Db.transfer.query.callsArgWith(0, builderStub)
      Db.transfer.query.returns(transfers)

      builderStub.innerJoin.returns({
        innerJoin: payeeStub.returns({
          leftJoin: stateChangeStub.returns({
            leftJoin: stateStub.returns({
              leftJoin: ilpStub.returns({
                select: selectStub.returns({
                  orderBy: orderStub.returns(transfers)
                })
              })
            })
          })
        })
      })

      let found = await Model.getAll()
      assert.equal(found, transfers)
      assert.ok(builderStub.innerJoin.withArgs('participant AS ca', 'transfer.payerParticipantId', 'ca.participantId').calledOnce)
      assert.ok(payeeStub.withArgs('participant AS da', 'transfer.payeeParticipantId', 'da.participantId').calledOnce)
      assert.ok(stateChangeStub.withArgs('transferStateChange AS tsc', 'transfer.transferId', 'tsc.transferId').calledOnce)
      assert.ok(stateStub.withArgs('transferState AS ts', 'ts.transferStateId', 'tsc.transferStateId').calledOnce)
      assert.ok(ilpStub.withArgs('ilp AS ilp', 'transfer.transferId', 'ilp.transferId').calledOnce)
      assert.ok(selectStub.withArgs(
        'transfer.*',
        'transfer.currencyId AS currency',
        'ca.name AS payerFsp',
        'da.name AS payeeFsp',
        'tsc.transferStateId AS internalTransferState',
        'tsc.changedDate AS completedTimestamp',
        'ts.enumeration AS transferState',
        'ilp.packet AS ilpPacket',
        'ilp.condition AS condition',
        'ilp.fulfilment AS fulfilment',
        'ilp.ilpId AS ilpId'
      ).calledOnce)
      assert.ok(orderStub.withArgs('tsc.transferStateChangeId', 'desc').calledOnce)
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`query transfer failed with error - ${err}`)
      sandbox.restore()
      assert.fail()
      assert.end()
    }
  })

  await transferTest.test('return all transfers should throw an error', async (assert) => {
    try {
      const transferId1 = 't1'
      const transferId2 = 't2'
      const transfers = [{transferId: transferId1}, {transferId: transferId2}]

      let builderStub = sandbox.stub()
      let payeeStub = sandbox.stub()
      let stateChangeStub = sandbox.stub()
      let stateStub = sandbox.stub()
      let ilpStub = sandbox.stub()
      let selectStub = sandbox.stub()
      let orderStub = sandbox.stub()

      builderStub.innerJoin = sandbox.stub()

      Db.transfer.query.callsArgWith(0, builderStub)
      Db.transfer.query.throws(new Error())

      builderStub.innerJoin.returns({
        innerJoin: payeeStub.returns({
          leftJoin: stateChangeStub.returns({
            leftJoin: stateStub.returns({
              leftJoin: ilpStub.returns({
                select: selectStub.returns({
                  orderBy: orderStub.returns(transfers)
                })
              })
            })
          })
        })
      })

      let found = await Model.getAll()
      assert.equal(found, transfers)
      assert.ok(builderStub.innerJoin.withArgs('participant AS ca', 'transfer.payerParticipantId', 'ca.participantId').calledOnce)
      assert.ok(payeeStub.withArgs('participant AS da', 'transfer.payeeParticipantId', 'da.participantId').calledOnce)
      assert.ok(stateChangeStub.withArgs('transferStateChange AS tsc', 'transfer.transferId', 'tsc.transferId').calledOnce)
      assert.ok(stateStub.withArgs('transferState AS ts', 'tsc.transferStateId', 'tsc.transferStateId').calledOnce)
      assert.ok(ilpStub.withArgs('ilp AS ilp', 'transfer.transferId', 'ilp.transferId').calledOnce)
      assert.ok(selectStub.withArgs(
        'transfer.*',
        'transfer.currencyId AS currency',
        'ca.name AS payerFsp',
        'da.name AS payeeFsp',
        'tsc.transferStateId AS internalTransferState',
        'tsc.changedDate AS completedTimestamp',
        'ts.enumeration AS transferState',
        'ilp.packet AS ilpPacket',
        'ilp.condition AS condition',
        'ilp.fulfilment AS fulfilment',
        'ilp.ilpId AS ilpId'
  ).calledOnce)
      assert.ok(orderStub.withArgs('tsc.=transferStateChangeId', 'desc').calledOnce)
      sandbox.restore()
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      Logger.error(`query transfer failed with error - ${err}`)
      sandbox.restore()
      assert.pass('Error thrown')
      assert.end()
    }
  })

  transferTest.end()
})
