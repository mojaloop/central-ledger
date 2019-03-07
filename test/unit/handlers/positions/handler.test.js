'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const allTransferHandlers = require('../../../../src/handlers/positions/handler')
const Kafka = require('../../../../src/handlers/lib/kafka')
const Validator = require('../../../../src/handlers/transfers/validator')
const TransferService = require('../../../../src/domain/transfer')
const PositionService = require('../../../../src/domain/position')
const Utility = require('../../../../src/handlers/lib/utility')
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const DAO = require('../../../../src/handlers/lib/dao')
const Uuid = require('uuid4')
const Logger = require('@mojaloop/central-services-shared').Logger
const TransferStateChange = require('../../../../src/models/transfer/transferStateChange')
const transferEventAction = require('../../../../src/lib/enum').transferEventAction
const Enum = require('../../../../src/lib/enum')
const TransferState = Enum.TransferState

const transfer = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'dfsp1',
  payeeFsp: 'dfsp2',
  amount: {
    currency: 'USD',
    amount: '433.88'
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

const transferInfo = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  transferStateId: TransferState.RECEIVED_FULFIL,
  // transferStateId: TransferState.RECEIVED_FULFIL,
  amount: {
    currency: 'USD',
    amount: '433.88'
  },
  participantCurrencyId: 1,
  reason: 'reason description'
}

const participantLimit = {
  participantLimitId: 1,
  participantCurrencyId: 1,
  participantLimitTypeId: 1,
  value: 1000000.00,
  thresholdAlarmPercentage: 10.0,
  startAfterParticipantPositionChangeId: null,
  isActive: 1,
  createdDate: '2018-07-19',
  createdBy: 'unknown'
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
      id: Uuid(),
      type: 'position',
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

const topicName = 'topic-test'

const messages = [
  {
    topic: topicName,
    value: messageProtocol
  }
]

let config = {
  options: {
    'mode': 2,
    'batchSize': 1,
    'pollFrequency': 10,
    'recursiveTimeout': 100,
    'messageCharset': 'utf8',
    'messageAsJSON': true,
    'sync': true,
    'consumeTimeout': 1000
  },
  rdkafkaConf: {
    'client.id': 'kafka-test',
    'debug': 'all',
    'group.id': 'central-ledger-kafka',
    'metadata.broker.list': 'localhost:9092',
    'enable.auto.commit': false
  }
}

const command = () => {
}

const participants = ['testName1', 'testName2']

Test('Position handler', transferHandlerTest => {
  let sandbox

  transferHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(DAO)
    sandbox.stub(KafkaConsumer.prototype, 'constructor').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'connect').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'consume').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').resolves()
    sandbox.stub(Kafka.Consumer, 'getConsumer').returns({
      commitMessageSync: async function () { return true }
    })

    sandbox.stub(Validator)
    sandbox.stub(TransferService)
    sandbox.stub(PositionService)
    sandbox.stub(Utility)
    sandbox.stub(TransferStateChange)
    Utility.transformAccountToTopicName.returns(topicName)
    Utility.produceGeneralMessage.resolves()
    test.end()
  })

  transferHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  transferHandlerTest.test('createPrepareHandler should', registerHandlersTest => {
    registerHandlersTest.test('register all consumers on Kafka', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      DAO.retrieveAllParticipants.resolves(participants)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      const result = await allTransferHandlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('Register a consumer on Kafka', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      await DAO.retrieveAllParticipants.resolves(participants)
      const result = await allTransferHandlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('Throw error retrieveAllParticipants', async (test) => {
      try {
        Kafka.Consumer.createHandler(topicName, config, command)
        await DAO.retrieveAllParticipants.resolves(participants)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.throws(new Error())
        await allTransferHandlers.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlersTest.test('Log and skip consumer registration when no participants', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        await DAO.retrieveAllParticipants.resolves([])
        const result = await allTransferHandlers.registerAllHandlers()
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlersTest.test('registerPrepareHandler topic list is passed', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.throws(new Error())
        await allTransferHandlers.registerPositionHandler()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlersTest.end()
  })

  transferHandlerTest.test('positions should be able to', positionsTest => {
    positionsTest.test('Update transferStateChange in the database for PREPARE when single message', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferStateChange.saveTransferStateChange.resolves(true)
      PositionService.calculatePreparePositionsBatch.returns({
        preparedMessagesList: [{
          transferState: { transferStateId: 'RESERVED' },
          rawMessage: {}
        }],
        limitAlarms: []
      })
      const result = await allTransferHandlers.positions(null, Object.assign({}, messages[0]))
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('throw error when not able to get consumer', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.getConsumer.throws(new Error())
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferStateChange.saveTransferStateChange.resolves(true)
      PositionService.calculatePreparePositionsBatch.returns({
        preparedMessagesList: [{
          transferState: { transferStateId: 'RESERVED' },
          rawMessage: {}
        }],
        limitAlarms: []
      })
      let message = JSON.parse(JSON.stringify(messages[0]))
      message.value.content.payload = undefined
      const result = await allTransferHandlers.positions(null, Object.assign({}, message))
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for PREPARE when single message and participant limit fail', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferStateChange.saveTransferStateChange.resolves(true)
      PositionService.calculatePreparePositionsBatch.returns({
        preparedMessagesList: [{
          transferState: { transferStateId: 'RESERVED' },
          rawMessage: {}
        }],
        limitAlarms: [participantLimit]
      })
      const result = await allTransferHandlers.positions(null, Object.assign({}, messages[0]))
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for PREPARE when single message and no transfer state id is available', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferStateChange.saveTransferStateChange.resolves(true)
      PositionService.calculatePreparePositionsBatch.returns({
        preparedMessagesList: [{
          transferState: 'RESERVED',
          rawMessage: {}
        }],
        limitAlarms: []
      })
      const result = await allTransferHandlers.positions(null, Object.assign({}, messages[0]))
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for PREPARE when messages is an array', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferStateChange.saveTransferStateChange.resolves(true)
      PositionService.calculatePreparePositionsBatch.returns({
        preparedMessagesList: [{
          transferState: { transferStateId: 'RESERVED' },
          rawMessage: {}
        }],
        limitAlarms: []
      })
      const result = await allTransferHandlers.positions(null, messages)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for PREPARE when messages is an array no transfer state id is available', async (test) => {
      config.rdkafkaConf['enable.auto.commit'] = true
      await Kafka.Consumer.createHandler(topicName, config, command)
      config.rdkafkaConf['enable.auto.commit'] = false
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferStateChange.saveTransferStateChange.resolves(true)
      PositionService.calculatePreparePositionsBatch.returns({
        preparedMessagesList: [{
          transferState: 'RESERVED',
          rawMessage: {}
        }],
        limitAlarms: []
      })
      const result = await allTransferHandlers.positions(null, Object.assign({}, messages[0]))
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for RECEIVED_FULFIL when single', async (test) => {
      const isIncrease = false
      const transferStateChange = {
        transferId: transferInfo.transferId,
        transferStateId: TransferState.COMMITTED
      }

      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)

      TransferService.getTransferInfoToChangePosition.withArgs(transfer.transferId, Enum.TransferParticipantRoleType.PAYEE_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE).returns(transferInfo)
      TransferStateChange.saveTransferStateChange.resolves(true)
      PositionService.changeParticipantPosition.withArgs(transferInfo.participantCurrencyId, isIncrease, transferInfo.amount, transferStateChange).resolves(true)
      let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
      m.value.metadata.event.action = transferEventAction.COMMIT
      const result = await allTransferHandlers.positions(null, m)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for RECEIVED_FULFIL when single -- consumer is null', async (test) => {
      const isIncrease = false
      const transferStateChange = {
        transferId: transferInfo.transferId,
        transferStateId: TransferState.COMMITTED
      }

      await Kafka.Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.getConsumer.returns(null)

      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)

      TransferService.getTransferInfoToChangePosition.withArgs(transfer.transferId, Enum.TransferParticipantRoleType.PAYEE_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE).returns(transferInfo)
      TransferStateChange.saveTransferStateChange.resolves(true)
      PositionService.changeParticipantPosition.withArgs(transferInfo.participantCurrencyId, isIncrease, transferInfo.amount, transferStateChange).resolves(true)
      let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
      m.value.metadata.event.action = transferEventAction.COMMIT
      const result = await allTransferHandlers.positions(null, m)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for FAKE when single', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)

        TransferService.getTransferInfoToChangePosition.withArgs(transfer.transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
          .returns(Object.assign({}, transferInfo, { transferStateId: 'FAKE' }))
        TransferStateChange.saveTransferStateChange.resolves(true)

        let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
        m.value.metadata.event.action = transferEventAction.REJECT
        const result = await allTransferHandlers.positions(null, m)
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        console.log('error thrown' + e)
        test.fail('Error thrown' + e)
        test.end()
      }
    })

    positionsTest.test('Update transferStateChange in the database for RECEIVED_ERROR and transferStateId is FAKE when single message', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferService.getTransferInfoToChangePosition.withArgs(transfer.transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
        .returns(Object.assign({}, transferInfo, { transferStateId: 'RECEIVED_ERROR' }))
      TransferStateChange.saveTransferStateChange.resolves(true)
      let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
      m.value.metadata.event.action = transferEventAction.REJECT
      const result = await allTransferHandlers.positions(null, m)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for REJECT and transferStateId is FAKE when single message', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferService.getTransferInfoToChangePosition.withArgs(transfer.transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
        .returns(Object.assign({}, transferInfo, { transferStateId: 'REJECT' }))
      TransferStateChange.saveTransferStateChange.resolves(true)
      let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
      m.value.metadata.event.action = transferEventAction.REJECT
      const result = await allTransferHandlers.positions(null, m)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for REJECT  and transferStateId is RECEIVED_REJECT when single message', async (test) => {
      const isIncrease = false
      const transferStateChange = {
        transferId: transferInfo.transferId,
        transferStateId: TransferState.ABORTED_REJECTED,
        reason: transferInfo.reason
      }
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      PositionService.changeParticipantPosition.withArgs(transferInfo.participantCurrencyId, isIncrease, transferInfo.amount, transferStateChange).resolves(true)

      TransferService.getTransferInfoToChangePosition.withArgs(transfer.transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
        .returns(Object.assign({}, transferInfo, { transferStateId: TransferState.RECEIVED_REJECT }))
      TransferStateChange.saveTransferStateChange.resolves(true)
      let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
      m.value.metadata.event.action = transferEventAction.REJECT
      const result = await allTransferHandlers.positions(null, m)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for REJECT  and transferStateId is RECEIVED_REJECT when single message', async (test) => {
      const isIncrease = false
      const transferStateChange = {
        transferId: transferInfo.transferId,
        transferStateId: TransferState.ABORTED_REJECTED,
        reason: transferInfo.reason
      }
      await Kafka.Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.getConsumer.throws(new Error())
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      PositionService.changeParticipantPosition.withArgs(transferInfo.participantCurrencyId, isIncrease, transferInfo.amount, transferStateChange).resolves(true)

      TransferService.getTransferInfoToChangePosition.withArgs(transfer.transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
        .returns(Object.assign({}, transferInfo, { transferStateId: TransferState.RECEIVED_REJECT }))
      TransferStateChange.saveTransferStateChange.resolves(true)
      let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
      m.value.metadata.event.action = transferEventAction.REJECT
      const result = await allTransferHandlers.positions(null, m)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for TIMEOUT_RECEIVED when messages is an array', async (test) => {
      config.rdkafkaConf['enable.auto.commit'] = true
      await Kafka.Consumer.createHandler(topicName, config, command)
      config.rdkafkaConf['enable.auto.commit'] = false
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)

      TransferService.getTransferInfoToChangePosition.withArgs(transfer.transferId, Enum.TransferParticipantRoleType.PAYEE_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
        .returns(Object.assign({}, transferInfo, { transferStateId: 'FAKE' }))
      TransferStateChange.saveTransferStateChange.resolves(true)
      let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
      m.value.metadata.event.action = transferEventAction.COMMIT
      const result = await allTransferHandlers.positions(null, [m])
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for REJECT and transferStateId is FAKE when single message', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferService.getTransferInfoToChangePosition.withArgs(transfer.transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
        .returns(Object.assign({}, transferInfo, { transferStateId: 'FAKE' }))
      TransferStateChange.saveTransferStateChange.resolves(true)
      let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
      m.value.metadata.event.action = transferEventAction.REJECT
      const result = await allTransferHandlers.positions(null, m)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for REJECT  and transferStateId is RECEIVED_REJECT when single message', async (test) => {
      const isIncrease = false
      const transferStateChange = {
        transferId: transferInfo.transferId,
        transferStateId: TransferState.ABORTED_REJECTED,
        reason: transferInfo.reason
      }
      config.rdkafkaConf['enable.auto.commit'] = true
      await Kafka.Consumer.createHandler(topicName, config, command)
      config.rdkafkaConf['enable.auto.commit'] = false
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      PositionService.changeParticipantPosition.withArgs(transferInfo.participantCurrencyId, isIncrease, transferInfo.amount, transferStateChange).resolves(true)

      TransferService.getTransferInfoToChangePosition.withArgs(transfer.transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
        .returns(Object.assign({}, transferInfo, { transferStateId: TransferState.RECEIVED_REJECT }))
      TransferStateChange.saveTransferStateChange.resolves(true)
      let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
      m.value.metadata.event.action = transferEventAction.REJECT
      const result = await allTransferHandlers.positions(null, m)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for TIMEOUT_RESERVED when messages is an array', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.createPrepareErrorStatus.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferStateChange.saveTransferStateChange.resolves(true)
        TransferService.getTransferInfoToChangePosition.resolves({ transferStateId: 'RESERVED_TIMEOUT' })
        let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
        m.value.metadata.event.action = transferEventAction.TIMEOUT_RESERVED
        const result = await allTransferHandlers.positions(null, [m])
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        console.log('error thrown' + e)
        test.fail('Error thrown' + e)
        test.end()
      }
    })

    positionsTest.test('Update transferStateChange in the database for TIMEOUT_RESERVED when messages is an array (auto.commit)', async (test) => {
      try {
        config.rdkafkaConf['enable.auto.commit'] = true
        await Kafka.Consumer.createHandler(topicName, config, command)
        config.rdkafkaConf['enable.auto.commit'] = false
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.createPrepareErrorStatus.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferStateChange.saveTransferStateChange.resolves(true)
        TransferService.getTransferInfoToChangePosition.resolves({ transferStateId: 'RESERVED_TIMEOUT' })
        let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
        m.value.metadata.event.action = transferEventAction.TIMEOUT_RESERVED
        const result = await allTransferHandlers.positions(null, [m])
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        console.log('error thrown' + e)
        test.fail('Error thrown' + e)
        test.end()
      }
    })

    positionsTest.test('Update transferStateChange in the database for TIMEOUT_RESERVED when messages is an array -- consumer throws error', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Kafka.Consumer.getConsumer.throws(new Error())
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.createPrepareErrorStatus.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferStateChange.saveTransferStateChange.resolves(true)
        TransferService.getTransferInfoToChangePosition.resolves({ transferStateId: 'RESERVED_TIMEOUT' })
        let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
        m.value.metadata.event.action = transferEventAction.TIMEOUT_RESERVED
        const result = await allTransferHandlers.positions(null, [m])
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        console.log('error thrown' + e)
        test.fail('Error thrown' + e)
        test.end()
      }
    })

    positionsTest.test('TIMEOUT_RESERVED should throw error if the transfer state is not RESERVED_TIMEOUT', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.createPrepareErrorStatus.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferStateChange.saveTransferStateChange.resolves(true)
        TransferService.getTransferInfoToChangePosition.resolves({ transferStateId: 'INVALID_STATE' })
        let m = Object.assign({}, JSON.parse(JSON.stringify(messages[0])))
        m.value.metadata.event.action = transferEventAction.TIMEOUT_RESERVED
        await allTransferHandlers.positions(null, [m])
        test.fail('should throw')
        test.end()
      } catch (e) {
        console.log('error thrown' + e)
        test.pass('Error thrown' + e)
        test.end()
      }
    })

    positionsTest.test('Throw error when invalid action is received', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferStateChange.saveTransferStateChange.resolves(true)
        messages[0].value.metadata.event.action = 'invalid'
        await allTransferHandlers.positions(null, messages)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    positionsTest.test('Throw error when invalid action is received (auto.commit)', async (test) => {
      try {
        config.rdkafkaConf['enable.auto.commit'] = true
        await Kafka.Consumer.createHandler(topicName, config, command)
        config.rdkafkaConf['enable.auto.commit'] = false
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferStateChange.saveTransferStateChange.resolves(true)
        messages[0].value.metadata.event.action = 'invalid'
        await allTransferHandlers.positions(null, messages)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    positionsTest.test('Throw error when invalid action is received -- consumer throws error', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Kafka.Consumer.getConsumer.throws(new Error())
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferStateChange.saveTransferStateChange.resolves(true)
        messages[0].value.metadata.event.action = 'invalid'
        const result = await allTransferHandlers.positions(null, messages)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail('Error thrown')
        test.end()
      }
    })
    positionsTest.test('Throw error on positions', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferStateChange.saveTransferStateChange.resolves(true)
        await allTransferHandlers.positions(new Error(), null)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })
    positionsTest.end()
  })
  transferHandlerTest.end()
})
