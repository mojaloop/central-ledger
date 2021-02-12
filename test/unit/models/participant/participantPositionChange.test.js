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

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../../src/models/participant/participantPositionChange')

Test('Participant Position model', async (participantPositionChangeTest) => {
  let sandbox

  participantPositionChangeTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.participantPositionChange = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      destroy: sandbox.stub(),
      query: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
    }
    t.end()
  })

  participantPositionChangeTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await participantPositionChangeTest.test('getByParticipantPositionId', async (assert) => {
    try {
      const builderStub = sandbox.stub()
      const selectStub = sandbox.stub()
      const orderByStub = sandbox.stub()
      const firstStub = sandbox.stub()

      builderStub.where = sandbox.stub()
      const participantPositionChange = {
        participantPositionId: 1,
        participantPositionChangeId: 1,
        transferStateChangeId: 1,
        value: 0.0,
        reservedValue: 0.0,
        changedDate: new Date()
      }

      Db.participantPositionChange.query.callsArgWith(0, builderStub)
      Db.participantPositionChange.query.returns(participantPositionChange)
      builderStub.where.returns({
        select: selectStub.returns({
          orderBy: orderByStub.returns({
            first: firstStub.returns(participantPositionChange)
          })
        })
      })

      const result = await Model.getByParticipantPositionId(1)
      assert.equal(JSON.stringify(result), JSON.stringify(participantPositionChange))
      assert.end()
    } catch (err) {
      console.log(err)
      Logger.error(`getByParticipantPositionId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantPositionChangeTest.test('getByParticipantPositionId should throw error', async (assert) => {
    try {
      Db.participantPositionChange.query.throws(new Error('message'))
      await await Model.getByParticipantPositionId(1)
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`getByParticipantPositionId failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  participantPositionChangeTest.end()
})
