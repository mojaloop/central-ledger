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
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../src/lib/enum')
const Db = require('../../../src/lib/db')

Test('Enum test', async (enumTest) => {
  let sandbox

  const allEnums = {
    endpointType: [
      {
        endpointTypeId: 1,
        name: 'ALARM_NOTIFICATION_URL'
      },
      {
        endpointTypeId: 2,
        name: 'ALARM_NOTIFICATION_TOPIC'
      }
    ],
    hubParticipant: {
      participantId: 1,
      name: 'Hub'
    },
    ledgerAccountType: [
      {
        ledgerAccountTypeId: 1,
        name: 'POSITION'
      },
      {
        ledgerAccountTypeId: 2,
        name: 'SETTLEMENT'
      },
      {
        ledgerAccountTypeId: 3,
        name: 'HUB_SETTLEMENT'
      }
    ],
    ledgerEntryType: [
      {
        ledgerEntryTypeId: 1,
        name: 'PRINCIPLE_VALUE'
      },
      {
        ledgerEntryTypeId: 2,
        name: 'INTERCHANGE_FEE'
      },
      {
        ledgerEntryTypeId: 3,
        name: 'HUB_FEE'
      }
    ],
    participantLimitType: [
      {
        participantLimitTypeId: 1,
        name: 'NET_DEBIT_CAP'
      }
    ],
    transferParticipantRoleType: [
      {
        transferParticipantRoleTypeId: 1,
        name: 'PAYER_DFSP'
      },
      {
        transferParticipantRoleTypeId: 2,
        name: 'PAYEE_DFSP'
      }
    ],
    transferState: [
      {
        transferStateId: 'ABORTED_REJECTED',
        enumeration: 'ABORTED_REJECTED'
      },
      {
        transferStateId: 'COMMITTED',
        enumeration: 'COMMITTED'
      }
    ],
    bulkProcessingState: [
      {
        bulkProcessingStateId: 1,
        name: 'RECEIVED'
      }
    ],
    bulkTransferState: [
      {
        bulkTransferStateId: 'RECEIVED',
        enumeration: 'RECEIVED'
      }
    ]
  }

  const allEnumExpected = {
    endpointType: {
      ALARM_NOTIFICATION_URL: 1,
      ALARM_NOTIFICATION_TOPIC: 2
    },
    hubParticipant: {
      participantId: 1,
      name: 'Hub'
    },
    ledgerAccountType: {
      POSITION: 1,
      SETTLEMENT: 2,
      HUB_SETTLEMENT: 3
    },
    ledgerEntryType: {
      PRINCIPLE_VALUE: 1,
      INTERCHANGE_FEE: 2,
      HUB_FEE: 3
    },
    participantLimitType: {
      NET_DEBIT_CAP: 1
    },
    transferParticipantRoleType: {
      PAYER_DFSP: 1,
      PAYEE_DFSP: 2
    },
    transferState: {
      ABORTED_REJECTED: 'ABORTED_REJECTED',
      COMMITTED: 'COMMITTED'
    },
    transferStateEnum: {
      ABORTED_REJECTED: 'ABORTED_REJECTED',
      COMMITTED: 'COMMITTED'
    },
    bulkProcessingState: {
      RECEIVED: 1
    },
    bulkTransferState: {
      RECEIVED: 'RECEIVED'
    },
    bulkTransferStateEnum: {
      RECEIVED: 'RECEIVED'
    }
  }

  enumTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()

    Db.endpointType = {
      find: sandbox.stub()
    }
    Db.ledgerAccountType = {
      find: sandbox.stub()
    }
    Db.ledgerEntryType = {
      find: sandbox.stub()
    }
    Db.participantLimitType = {
      find: sandbox.stub()
    }
    Db.participant = {
      find: sandbox.stub()
    }
    Db.transferParticipantRoleType = {
      find: sandbox.stub()
    }
    Db.transferState = {
      find: sandbox.stub()
    }
    Db.bulkProcessingState = {
      find: sandbox.stub()
    }
    Db.bulkTransferState = {
      find: sandbox.stub()
    }

    Db.from = (table) => {
      return Db[table]
    }

    t.end()
  })

  enumTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await enumTest.test('endpointType should', async (endpointTypeTest) => {
    await endpointTypeTest.test('return the endpoints', async (test) => {
      try {
        Db.from('endpointType').find.returns(Promise.resolve(allEnums.endpointType))
        const result = await Model.endpointType()
        test.deepEqual(result, allEnumExpected.endpointType, 'Results match')
        test.end()
      } catch (err) {
        Logger.error(`endpointType failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await endpointTypeTest.test('throw error on error while getting endpoints', async (test) => {
      try {
        Db.endpointType.find.throws(new Error())
        await Model.endpointType()
        test.fail('should throw error')
        test.end()
      } catch (err) {
        test.ok(err instanceof Error)
        test.end()
      }
    })

    await endpointTypeTest.end()
  })

  await enumTest.test('hubParticipant should', async (hubParticipantTest) => {
    await hubParticipantTest.test('throw error', async (test) => {
      try {
        Db.participant.find.throws(new Error())
        await Model.hubParticipant()
        test.fail('should throw error')
        test.end()
      } catch (err) {
        test.ok(err instanceof Error)
        test.end()
      }
    })

    await hubParticipantTest.end()
  })

  await enumTest.test('ledgerAccountType should', async (ledgerAccountTypeTest) => {
    await ledgerAccountTypeTest.test('return the ledgerAccountType', async (test) => {
      try {
        Db.ledgerAccountType.find.returns(Promise.resolve(allEnums.ledgerAccountType))
        const result = await Model.ledgerAccountType()
        test.deepEqual(result, allEnumExpected.ledgerAccountType, 'Results match')
        test.end()
      } catch (err) {
        Logger.error(`ledgerAccountType failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await ledgerAccountTypeTest.test('throw error on error while getting ledgerAccountType', async (test) => {
      try {
        Db.ledgerAccountType.find.throws(new Error())
        await Model.ledgerAccountType()
        test.fail('should throw error')
        test.end()
      } catch (err) {
        test.ok(err instanceof Error)
        test.end()
      }
    })

    await ledgerAccountTypeTest.end()
  })

  await enumTest.test('ledgerEntryType should', async (ledgerEntryTypeTest) => {
    await ledgerEntryTypeTest.test('return the ledgerEntryType', async (test) => {
      try {
        Db.ledgerEntryType.find.returns(Promise.resolve(allEnums.ledgerEntryType))
        const result = await Model.ledgerEntryType()
        test.deepEqual(result, allEnumExpected.ledgerEntryType, 'Results match')
        test.end()
      } catch (err) {
        Logger.error(`ledgerEntryType failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await ledgerEntryTypeTest.test('throw error on error while getting ledgerEntryType', async (test) => {
      try {
        Db.ledgerEntryType.find.throws(new Error())
        await Model.ledgerEntryType()
        test.fail('should throw error')
        test.end()
      } catch (err) {
        test.ok(err instanceof Error)
        test.end()
      }
    })

    await ledgerEntryTypeTest.end()
  })

  await enumTest.test('participantLimitType should', async (participantLimitTypeTest) => {
    await participantLimitTypeTest.test('return the participantLimitType', async (test) => {
      try {
        Db.participantLimitType.find.returns(Promise.resolve(allEnums.participantLimitType))
        const result = await Model.participantLimitType()
        test.deepEqual(result, allEnumExpected.participantLimitType, 'Results match')
        test.end()
      } catch (err) {
        Logger.error(`participantLimitType failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await participantLimitTypeTest.test('throw error on error while getting participantLimitType', async (test) => {
      try {
        Db.participantLimitType.find.throws(new Error())
        await Model.participantLimitType()
        test.fail('should throw error')
        test.end()
      } catch (err) {
        test.ok(err instanceof Error)
        test.end()
      }
    })

    await participantLimitTypeTest.end()
  })

  await enumTest.test('transferParticipantRoleType should', async (transferParticipantRoleTypeTest) => {
    await transferParticipantRoleTypeTest.test('return the transferParticipantRoleType', async (test) => {
      try {
        Db.transferParticipantRoleType.find.returns(Promise.resolve(allEnums.transferParticipantRoleType))
        const result = await Model.transferParticipantRoleType()
        test.deepEqual(result, allEnumExpected.transferParticipantRoleType, 'Results match')
        test.end()
      } catch (err) {
        Logger.error(`transferParticipantRoleType failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await transferParticipantRoleTypeTest.test('throw error on error while getting transferParticipantRoleType', async (test) => {
      try {
        Db.transferParticipantRoleType.find.throws(new Error())
        await Model.transferParticipantRoleType()
        test.fail('should throw error')
        test.end()
      } catch (err) {
        test.ok(err instanceof Error)
        test.end()
      }
    })

    await transferParticipantRoleTypeTest.end()
  })

  await enumTest.test('transferState should', async (transferStateTest) => {
    await transferStateTest.test('return the transferState', async (test) => {
      try {
        Db.transferState.find.returns(Promise.resolve(allEnums.transferState))
        const result = await Model.transferState()
        test.deepEqual(result, allEnumExpected.transferState, 'Results match')
        test.end()
      } catch (err) {
        Logger.error(`transferState failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await transferStateTest.test('throw error on error while getting transferState', async (test) => {
      try {
        Db.transferState.find.throws(new Error())
        await Model.transferState()
        test.fail('should throw error')
        test.end()
      } catch (err) {
        test.ok(err instanceof Error)
        test.end()
      }
    })

    await transferStateTest.end()
  })

  await enumTest.test('transferStateEnum should', async (transferStateEnumTest) => {
    await transferStateEnumTest.test('return the transferStateEnum', async (test) => {
      try {
        Db.transferState.find.returns(Promise.resolve(allEnums.transferState))
        const result = await Model.transferStateEnum()
        test.deepEqual(result, allEnumExpected.transferStateEnum, 'Results match')
        test.end()
      } catch (err) {
        Logger.error(`transferStateEnum failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await transferStateEnumTest.test('throw error on error while getting transferStateEnum', async (test) => {
      try {
        Db.transferState.find.throws(new Error())
        await Model.transferStateEnum()
        test.fail('should throw error')
        test.end()
      } catch (err) {
        test.ok(err instanceof Error)
        test.end()
      }
    })

    await transferStateEnumTest.end()
  })

  await enumTest.test('bulkProcessingState should', async (bulkProcessingStateTest) => {
    await bulkProcessingStateTest.test('return the bulkProcessingState', async (test) => {
      try {
        Db.bulkProcessingState.find.returns(Promise.resolve(allEnums.bulkProcessingState))
        const result = await Model.bulkProcessingState()
        test.deepEqual(result, allEnumExpected.bulkProcessingState, 'Results match')
        test.end()
      } catch (err) {
        Logger.error(`bulkProcessingState failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await bulkProcessingStateTest.test('throw error on error while getting bulkProcessingState', async (test) => {
      try {
        Db.bulkProcessingState.find.throws(new Error())
        await Model.bulkProcessingState()
        test.fail('should throw error')
        test.end()
      } catch (err) {
        test.ok(err instanceof Error)
        test.end()
      }
    })

    await bulkProcessingStateTest.end()
  })

  await enumTest.test('bulkTransferState should', async (bulkTransferStateTest) => {
    await bulkTransferStateTest.test('return the bulkTransferState', async (test) => {
      try {
        Db.bulkTransferState.find.returns(Promise.resolve(allEnums.bulkTransferState))
        const result = await Model.bulkTransferState()
        test.deepEqual(result, allEnumExpected.bulkTransferState, 'Results match')
        test.end()
      } catch (err) {
        Logger.error(`bulkTransferState failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await bulkTransferStateTest.test('throw error on error while getting bulkTransferState', async (test) => {
      try {
        Db.bulkTransferState.find.throws(new Error())
        await Model.bulkTransferState()
        test.fail('should throw error')
        test.end()
      } catch (err) {
        test.ok(err instanceof Error)
        test.end()
      }
    })

    await bulkTransferStateTest.end()
  })

  await enumTest.test('bulkTransferStateEnum should', async (bulkTransferStateEnumTest) => {
    await bulkTransferStateEnumTest.test('return the bulkTransferStateEnum', async (test) => {
      try {
        Db.bulkTransferState.find.returns(Promise.resolve(allEnums.bulkTransferState))
        const result = await Model.bulkTransferStateEnum()
        test.deepEqual(result, allEnumExpected.bulkTransferState, 'Results match')
        test.end()
      } catch (err) {
        Logger.error(`bulkTransferStateEnum failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await bulkTransferStateEnumTest.test('throw error on error while getting bulkTransferStateEnum', async (test) => {
      try {
        Db.bulkTransferState.find.throws(new Error())
        await Model.bulkTransferStateEnum()
        test.fail('should throw error')
        test.end()
      } catch (err) {
        test.ok(err instanceof Error)
        test.end()
      }
    })

    await bulkTransferStateEnumTest.end()
  })

  await enumTest.end()
})
