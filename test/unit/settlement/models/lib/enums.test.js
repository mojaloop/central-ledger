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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const { logger } = require('../../../../../src/settlement/shared/logger')
const Enums = require('../../../../../src/settlement/models/lib/enums')
const Db = require('../../../../../src/settlement/lib/db')

Test('Enums', async (enumsTest) => {
  let sandbox

  enumsTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()

    Db.from = (table) => {
      return Db[table]
    }

    test.end()
  })

  enumsTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await enumsTest.test('settlementWindowStates should', async settlementWindowStatesTest => {
    try {
      await settlementWindowStatesTest.test('return', async test => {
        try {
          const states = [
            { settlementWindowStateId: 'OPEN', enumeration: 'OPEN' },
            { settlementWindowStateId: 'CLOSED', enumeration: 'CLOSED' },
            { settlementWindowStateId: 'PENDING_SETTLEMENT', enumeration: 'PENDING_SETTLEMENT' },
            { settlementWindowStateId: 'SETTLED', enumeration: 'SETTLED' },
            { settlementWindowStateId: 'ABORTED', enumeration: 'ABORTED' }
          ]
          Db.settlementWindowState = { find: sandbox.stub().returns(states) }
          let settlementWindowStatesEnum = await Enums.settlementWindowStates()
          test.equal(Object.keys(settlementWindowStatesEnum).length, states.length, 'settlement window states enum')
          Db.settlementWindowState.find = sandbox.stub().returns(undefined)
          settlementWindowStatesEnum = await Enums.settlementWindowStates()
          test.notOk(settlementWindowStatesEnum, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`settlementWindowStates failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementWindowStatesTest.test('throw error if database is unavailable', async test => {
        try {
          Db.settlementWindowState = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.settlementWindowStates()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementWindowStates failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await settlementWindowStatesTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      settlementWindowStatesTest.fail()
      settlementWindowStatesTest.end()
    }
  })

  await enumsTest.test('settlementStates should', async settlementStatesTest => {
    try {
      await settlementStatesTest.test('return', async test => {
        try {
          const states = [
            { settlementStateId: 'PENDING_SETTLEMENT', enumeration: 'PENDING_SETTLEMENT' },
            { settlementStateId: 'SETTLED', enumeration: 'SETTLED' },
            { settlementStateId: 'ABORTED', enumeration: 'ABORTED' }
          ]
          Db.settlementState = { find: sandbox.stub().returns(states) }
          let settlementStatesEnum = await Enums.settlementStates()
          test.equal(Object.keys(settlementStatesEnum).length, states.length, 'settlement states enum')
          Db.settlementState.find = sandbox.stub().returns(undefined)
          settlementStatesEnum = await Enums.settlementStates()
          test.notOk(settlementStatesEnum, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`settlementStates failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementStatesTest.test('throw error if database is unavailable', async test => {
        try {
          Db.settlementState = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.settlementStates()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementStates failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await settlementStatesTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      settlementStatesTest.fail()
      settlementStatesTest.end()
    }
  })

  await enumsTest.test('transferStates should', async transferStatesTest => {
    try {
      await transferStatesTest.test('return', async test => {
        try {
          const states = [
            { transferStateId: 'RECEIVED_PREPARE', enumeration: 'RECEIVED' },
            { transferStateId: 'RECEIVED_FULFIL', enumeration: 'RESERVED' },
            { transferStateId: 'COMMITTED', enumeration: 'COMMITTED' },
            { transferStateId: 'RESERVED_TIMEOUT', enumeration: 'RESERVED' },
            { transferStateId: 'REJECTED', enumeration: 'RESERVED' },
            { transferStateId: 'ABORTED', enumeration: 'ABORTED' },
            { transferStateId: 'EXPIRED_PREPARED', enumeration: 'ABORTED' },
            { transferStateId: 'EXPIRED_RESERVED', enumeration: 'ABORTED' },
            { transferStateId: 'INVALID', enumeration: 'ABORTED' }
          ]
          Db.transferState = { find: sandbox.stub().returns(states) }
          let transferStatesEnum = await Enums.transferStates()
          test.equal(Object.keys(transferStatesEnum).length, states.length, 'transfer states enum')
          Db.transferState.find = sandbox.stub().returns(undefined)
          transferStatesEnum = await Enums.transferStates()
          test.notOk(transferStatesEnum, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`transferStates failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await transferStatesTest.test('throw error if database is unavailable', async test => {
        try {
          Db.transferState = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.transferStates()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`transferStates failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await transferStatesTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      transferStatesTest.fail()
      transferStatesTest.end()
    }
  })

  await enumsTest.test('transferStateEnums should', async transferStateEnumsTest => {
    try {
      await transferStateEnumsTest.test('return', async test => {
        try {
          const states = [
            { enumeration: 'RECEIVED' },
            { enumeration: 'RESERVED' },
            { enumeration: 'COMMITTED' },
            { enumeration: 'ABORTED' },
            { enumeration: 'ABORTED' }
          ]
          Db.transferState = { find: sandbox.stub().returns(states) }
          let transferStateEnumsEnum = await Enums.transferStateEnums()
          test.equal(Object.keys(transferStateEnumsEnum).length, states.length - 1, 'transfer states enum')

          Db.transferState.find = sandbox.stub().returns(undefined)
          transferStateEnumsEnum = await Enums.transferStateEnums()
          test.notOk(transferStateEnumsEnum, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`transferStateEnums failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await transferStateEnumsTest.test('throw error if database is unavailable', async test => {
        try {
          Db.transferState = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.transferStateEnums()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`transferStateEnums failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await transferStateEnumsTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      transferStateEnumsTest.fail()
      transferStateEnumsTest.end()
    }
  })

  await enumsTest.test('ledgerAccountTypes should', async ledgerAccountTypesTest => {
    try {
      await ledgerAccountTypesTest.test('return', async test => {
        try {
          const states = [
            { ledgerAccountTypeId: 1, name: 'POSITION' },
            { ledgerAccountTypeId: 2, name: 'SETTLEMENT' },
            { ledgerAccountTypeId: 3, name: 'HUB_SETTLEMENT' }
          ]
          Db.ledgerAccountType = { find: sandbox.stub().returns(states) }
          let ledgerAccountTypesEnum = await Enums.ledgerAccountTypes()
          test.equal(Object.keys(ledgerAccountTypesEnum).length, states.length, 'ledger account type enum')
          Db.ledgerAccountType.find = sandbox.stub().returns(undefined)
          ledgerAccountTypesEnum = await Enums.ledgerAccountTypes()
          test.notOk(ledgerAccountTypesEnum, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`ledgerAccountTypes failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await ledgerAccountTypesTest.test('throw error if database is unavailable', async test => {
        try {
          Db.ledgerAccountType = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.ledgerAccountTypes()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`ledgerAccountTypes failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await ledgerAccountTypesTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      ledgerAccountTypesTest.fail()
      ledgerAccountTypesTest.end()
    }
  })

  await enumsTest.test('ledgerEntryTypes should', async ledgerEntryTypesTest => {
    try {
      await ledgerEntryTypesTest.test('return', async test => {
        try {
          const states = [
            { ledgerEntryTypeId: 1, name: 'PRINCIPLE_VALUE' },
            { ledgerEntryTypeId: 2, name: 'INTERCHANGE_FEE' },
            { ledgerEntryTypeId: 3, name: 'HUB_FEE' }
          ]
          Db.ledgerEntryType = { find: sandbox.stub().returns(states) }
          let ledgerEntryTypesEnum = await Enums.ledgerEntryTypes()
          test.equal(Object.keys(ledgerEntryTypesEnum).length, states.length, 'ledger entry type enum')
          Db.ledgerEntryType.find = sandbox.stub().returns(undefined)
          ledgerEntryTypesEnum = await Enums.ledgerEntryTypes()
          test.notOk(ledgerEntryTypesEnum, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`ledgerEntryTypes failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await ledgerEntryTypesTest.test('throw error if database is unavailable', async test => {
        try {
          Db.ledgerEntryType = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.ledgerEntryTypes()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`ledgerEntryTypes failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await ledgerEntryTypesTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      ledgerEntryTypesTest.fail()
      ledgerEntryTypesTest.end()
    }
  })

  await enumsTest.test('transferParticipantRoleTypes should', async transferParticipantRoleTypesTest => {
    try {
      await transferParticipantRoleTypesTest.test('return', async test => {
        try {
          const states = [
            { transferParticipantRoleTypeId: 1, name: 'PAYER_DFSP' },
            { transferParticipantRoleTypeId: 2, name: 'PAYEE_DFSP' },
            { transferParticipantRoleTypeId: 3, name: 'HUB' }
          ]
          Db.transferParticipantRoleType = { find: sandbox.stub().returns(states) }
          let transferParticipantRoleTypesEnum = await Enums.transferParticipantRoleTypes()
          test.equal(Object.keys(transferParticipantRoleTypesEnum).length, states.length, 'transfer participant role type enum')
          Db.transferParticipantRoleType.find = sandbox.stub().returns(undefined)
          transferParticipantRoleTypesEnum = await Enums.transferParticipantRoleTypes()
          test.notOk(transferParticipantRoleTypesEnum, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`transferParticipantRoleTypes failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await transferParticipantRoleTypesTest.test('throw error if database is unavailable', async test => {
        try {
          Db.transferParticipantRoleType = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.transferParticipantRoleTypes()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`transferParticipantRoleTypes failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await transferParticipantRoleTypesTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      transferParticipantRoleTypesTest.fail()
      transferParticipantRoleTypesTest.end()
    }
  })

  await enumsTest.test('participantLimitTypes should', async participantLimitTypesTest => {
    try {
      await participantLimitTypesTest.test('return', async test => {
        try {
          const states = [
            { participantLimitTypeId: 1, name: 'NET_DEBIT_CAP' }
          ]
          Db.participantLimitType = { find: sandbox.stub().returns(states) }
          let participantLimitTypesEnum = await Enums.participantLimitTypes()
          test.equal(Object.keys(participantLimitTypesEnum).length, states.length, 'participant limit type enum')
          Db.participantLimitType.find = sandbox.stub().returns(undefined)
          participantLimitTypesEnum = await Enums.participantLimitTypes()
          test.notOk(participantLimitTypesEnum, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`participantLimitTypes failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await participantLimitTypesTest.test('throw error if database is unavailable', async test => {
        try {
          Db.participantLimitType = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.participantLimitTypes()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`participantLimitTypes failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await participantLimitTypesTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      participantLimitTypesTest.fail()
      participantLimitTypesTest.end()
    }
  })

  await enumsTest.test('settlementDelay should', async settlementDelayTest => {
    try {
      await settlementDelayTest.test('return', async test => {
        try {
          const delays = [
            { settlementDelayId: 1, name: 'IMMEDIATE' }
          ]
          Db.settlementDelay = { find: sandbox.stub().returns(delays) }
          let settlementDelays = await Enums.settlementDelay()
          test.equal(Object.keys(settlementDelays).length, delays.length, 'settlement delays')
          Db.settlementDelay.find = sandbox.stub().returns(undefined)
          settlementDelays = await Enums.settlementDelay()
          test.notOk(settlementDelays, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`settlementDelay failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementDelayTest.test('throw error if database is unavailable', async test => {
        try {
          Db.settlementDelay = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.settlementDelay()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementDelay failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await settlementDelayTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      settlementDelayTest.fail()
      settlementDelayTest.end()
    }
  })

  await enumsTest.test('settlementDelayEnum should', async settlementDelayEnumTest => {
    try {
      await settlementDelayEnumTest.test('return', async test => {
        try {
          const delays = [
            { settlementDelayId: 1, name: 'IMMEDIATE' }
          ]
          Db.settlementDelay = { find: sandbox.stub().returns(delays) }
          let settlementDelayEnum = await Enums.settlementDelayEnums()
          test.equal(Object.keys(settlementDelayEnum).length, delays.length, 'settlement delay enum')
          Db.settlementDelay.find = sandbox.stub().returns(undefined)
          settlementDelayEnum = await Enums.settlementDelayEnums()
          test.notOk(settlementDelayEnum, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`settlementDelay failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementDelayEnumTest.test('throw error if database is unavailable', async test => {
        try {
          Db.settlementDelay = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.settlementDelayEnums()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementDelay failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await settlementDelayEnumTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      settlementDelayEnumTest.fail()
      settlementDelayEnumTest.end()
    }
  })

  await enumsTest.test('settlementGranularity should', async settlementGranularityTest => {
    try {
      await settlementGranularityTest.test('return', async test => {
        try {
          const granularityList = [
            { settlementGranularityId: 1, name: 'GROSS' }
          ]
          Db.settlementGranularity = { find: sandbox.stub().returns(granularityList) }
          let settlementGranularityList = await Enums.settlementGranularity()
          test.equal(Object.keys(settlementGranularityList).length, granularityList.length, 'settlement granularity list')
          Db.settlementGranularity.find = sandbox.stub().returns(undefined)
          settlementGranularityList = await Enums.settlementGranularity()
          test.notOk(settlementGranularityList, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`settlementGranularity failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementGranularityTest.test('throw error if database is unavailable', async test => {
        try {
          Db.settlementGranularity = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.settlementGranularity()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementGranularity failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await settlementGranularityTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      settlementGranularityTest.fail()
      settlementGranularityTest.end()
    }
  })

  await enumsTest.test('settlementGranularityEnum should', async settlementGranularityEnumTest => {
    try {
      await settlementGranularityEnumTest.test('return', async test => {
        try {
          const granularityList = [
            { settlementGranularityId: 1, name: 'GROSS' }
          ]
          Db.settlementGranularity = { find: sandbox.stub().returns(granularityList) }
          let settlementGranularityEnum = await Enums.settlementGranularityEnums()
          test.equal(Object.keys(settlementGranularityEnum).length, granularityList.length, 'settlement Granularity enum')
          Db.settlementGranularity.find = sandbox.stub().returns(undefined)
          settlementGranularityEnum = await Enums.settlementGranularityEnums()
          test.notOk(settlementGranularityEnum, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`settlementGranularity failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementGranularityEnumTest.test('throw error if database is unavailable', async test => {
        try {
          Db.settlementGranularity = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.settlementGranularityEnums()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementGranularity failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await settlementGranularityEnumTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      settlementGranularityEnumTest.fail()
      settlementGranularityEnumTest.end()
    }
  })

  await enumsTest.test('settlementInterchange should', async settlementInterchangeTest => {
    try {
      await settlementInterchangeTest.test('return', async test => {
        try {
          const interchangeList = [
            { settlementInterchangeId: 1, name: 'BILATERAL' }
          ]
          Db.settlementInterchange = { find: sandbox.stub().returns(interchangeList) }
          let settlementInterchangeList = await Enums.settlementInterchange()
          test.equal(Object.keys(settlementInterchangeList).length, interchangeList.length, 'settlement interchange list')
          Db.settlementInterchange.find = sandbox.stub().returns(undefined)
          settlementInterchangeList = await Enums.settlementInterchange()
          test.notOk(settlementInterchangeList, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`settlementInterchange failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementInterchangeTest.test('throw error if database is unavailable', async test => {
        try {
          Db.settlementInterchange = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.settlementInterchange()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementInterchange failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await settlementInterchangeTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      settlementInterchangeTest.fail()
      settlementInterchangeTest.end()
    }
  })

  await enumsTest.test('settlementInterchangeEnum should', async settlementInterchangeEnumTest => {
    try {
      await settlementInterchangeEnumTest.test('return', async test => {
        try {
          const interchangeList = [
            { settlementInterchangeId: 1, name: 'GROSS' }
          ]
          Db.settlementInterchange = { find: sandbox.stub().returns(interchangeList) }
          let settlementInterchangeEnum = await Enums.settlementInterchangeEnums()
          test.equal(Object.keys(settlementInterchangeEnum).length, interchangeList.length, 'settlement interchange enum')
          Db.settlementInterchange.find = sandbox.stub().returns(undefined)
          settlementInterchangeEnum = await Enums.settlementInterchangeEnums()
          test.notOk(settlementInterchangeEnum, 'undefined when no record is returned')
          test.end()
        } catch (err) {
          logger.error(`settlementInterchange failed with error - ${err}`)
          test.fail()
          test.end()
        }
      })

      await settlementInterchangeEnumTest.test('throw error if database is unavailable', async test => {
        try {
          Db.settlementInterchange = { find: sandbox.stub().throws(new Error('Database unavailable')) }
          await Enums.settlementInterchangeEnums()
          test.fail('Error not thrown!')
          test.end()
        } catch (err) {
          logger.error(`settlementInterchange failed with error - ${err}`)
          test.pass('Error thrown')
          test.end()
        }
      })
      await settlementInterchangeEnumTest.end()
    } catch (err) {
      logger.error(`enumsTest failed with error - ${err}`)
      settlementInterchangeEnumTest.fail()
      settlementInterchangeEnumTest.end()
    }
  })

  await enumsTest.end()
})
