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

 * Lewis Daly <lewis@vesselstech.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Model = require('../../../../src/models/misc/migrationLock')

Test('MigrationLock model', async (migrationLockTest) => {
  let sandbox

  migrationLockTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.migration_lock = {
      query: sandbox.stub()
    }

    Db.from = (table) => {
      return Db[table]
    }

    const builderStub = sandbox.stub()
    builderStub.select = sandbox.stub()

    Db.migration_lock.query.callsArgWith(0, builderStub)
    builderStub.select.returns({
      orderBy: sandbox.stub().returns({
        first: sandbox.stub().returns()
      })
    })

    t.end()
  })

  migrationLockTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  migrationLockTest.test('getIsMigrationLocked should', async getIsMigrationLockedTest => {
    getIsMigrationLockedTest.test('return false if the table is not locked', async test => {
      // Arrange
      Db.migration_lock.query.returns({ isLocked: false })

      // Act
      const result = await Model.getIsMigrationLocked()

      // Assert
      test.equal(result, false, 'Table should be unlocked')
      test.end()
    })

    getIsMigrationLockedTest.test('return true if the table is locked', async test => {
      // Arrange
      Db.migration_lock.query.returns({ isLocked: true })

      // Act
      const result = await Model.getIsMigrationLocked()

      // Assert
      test.equal(result, true, 'Table should be locked')
      test.end()
    })

    getIsMigrationLockedTest.test('throw if an error occours', async test => {
      // Arrange
      Db.migration_lock.query.returns(Promise.reject(new Error('Error running query')))

      // Act
      try {
        await Model.getIsMigrationLocked()
        test.fail('Error should have thrown')
      } catch (err) {
        // Assert
        test.equal(err.message, 'Error running query', 'Error messages should match.')
        test.pass('Error thrown')
      }
      test.end()
    })

    getIsMigrationLockedTest.end()
  })

  migrationLockTest.end()
})
