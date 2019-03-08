'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const adminHandler = require('../../../../src/handlers/admin/handler')
const Kafka = require('../../../../src/handlers/lib/kafka')
const Utility = require('../../../../src/handlers/lib/utility')
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const DAO = require('../../../../src/handlers/lib/dao')
const Uuid = require('uuid4')
const Logger = require('@mojaloop/central-services-shared').Logger
const TransferService = require('../../../../src/domain/transfer')
const Db = require('../../../../src/db/index')
const Enum = require('../../../../src/lib/enum')
const TransferState = Enum.TransferState

const transfer = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'dfsp1',
  payeeFsp: 'hub',
  externalReference: 'string',
  action: 'recordFundsIn',
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

const transferRecordOutPrepare = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'dfsp1',
  payeeFsp: 'hub',
  externalReference: 'string',
  action: 'recordFundsOutPrepareReserve',
  amount: {
    currency: 'USD',
    amount: '433.88'
  },
  ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
  condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
  expirationDate: '2020-05-24T08:38:08.699-04:00',
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

const messageProtocolRecordFundsIn = {
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
      type: 'admin',
      action: 'transfer',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    },
    request: {
      params: {
        id: 1
      },
      enums: {}
    }
  },
  pp: ''
}

const messageProtocolrecordFundsOutPrepareReserve = {
  id: transferRecordOutPrepare.transferId,
  from: transferRecordOutPrepare.payerFsp,
  to: transferRecordOutPrepare.payeeFsp,
  type: 'application/json',
  content: {
    header: '',
    payload: transferRecordOutPrepare
  },
  metadata: {
    event: {
      id: Uuid(),
      type: 'admin',
      action: 'transfer',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    },
    request: {
      params: {
        id: 1
      },
      enums: {}
    }
  },
  pp: ''
}

const transferRecordOutCommit = {
  id: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'dfsp1',
  payeeFsp: 'hub',
  action: 'recordFundsOutCommit',
  reason: 'Reason for in/out flow of funds'
}

const messageProtocolRecordFundsOutCommit = {
  id: transferRecordOutCommit.transferId,
  from: transferRecordOutCommit.payerFsp,
  to: transferRecordOutCommit.payeeFsp,
  type: 'application/json',
  content: {
    header: '',
    payload: transferRecordOutCommit
  },
  metadata: {
    event: {
      id: Uuid(),
      type: 'admin',
      action: 'transfer',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    },
    request: {
      params: {
        id: 1
      },
      enums: {}
    }
  },
  pp: ''
}

const transferRecordOutAbort = {
  id: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'dfsp1',
  payeeFsp: 'hub',
  action: 'recordFundsOutAbort',
  reason: 'Reason for in/out flow of funds',
  amount: '433.88',
  currencyId: 'USD'
}

const messageProtocolRecordFundsOutAbort = {
  id: transferRecordOutAbort.transferId,
  from: transferRecordOutAbort.payerFsp,
  to: transferRecordOutAbort.payeeFsp,
  type: 'application/json',
  content: {
    header: '',
    payload: transferRecordOutAbort
  },
  metadata: {
    event: {
      id: Uuid(),
      type: 'admin',
      action: 'transfer',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    },
    request: {
      params: {
        id: 1
      },
      enums: {}
    }
  },
  pp: ''
}

const transferRecordWrongAction = {
  id: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'dfsp1',
  payeeFsp: 'hub',
  action: 'wrong',
  reason: 'Reason for in/out flow of funds',
  amount: '433.88',
  currencyId: 'USD'
}
const topicName = 'topic-test'

const messageProtocolWrongAction = {
  topic: topicName,
  value: {
    id: transferRecordWrongAction.transferId,
    from: transferRecordWrongAction.payerFsp,
    to: transferRecordWrongAction.payeeFsp,
    type: 'application/json',
    content: {
      header: '',
      payload: transferRecordWrongAction
    },
    metadata: {
      event: {
        id: Uuid(),
        type: 'admin',
        action: 'transfer',
        createdAt: new Date(),
        state: {
          status: 'success',
          code: 0
        }
      },
      request: {
        params: {
          id: 1
        },
        enums: {}
      }
    },
    pp: ''
  }
}

const messages = [
  {
    topic: topicName,
    value: messageProtocolRecordFundsIn
  },
  {
    topic: topicName,
    value: messageProtocolrecordFundsOutPrepareReserve
  },
  {
    topic: topicName,
    value: messageProtocolRecordFundsOutCommit
  },
  {
    topic: topicName,
    value: messageProtocolRecordFundsOutAbort
  }
]

const config = {
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

const participants = ['dfsp1', 'dfsp2']

Test('Admin handler', adminHandlerTest => {
  let sandbox

  adminHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(DAO)
    sandbox.stub(KafkaConsumer.prototype, 'constructor').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'connect').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'consume').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').resolves()
    sandbox.stub(Kafka.Consumer, 'getConsumer').returns({
      commitMessageSync: async function () { return true }
    })
    sandbox.stub(Kafka.Consumer, 'isConsumerAutoCommitEnabled')

    sandbox.stub(Utility)
    sandbox.stub(TransferService, 'validateDuplicateHash')
    sandbox.stub(TransferService, 'reconciliationTransferPrepare')
    sandbox.stub(TransferService, 'reconciliationTransferReserve')
    sandbox.stub(TransferService, 'reconciliationTransferCommit')
    sandbox.stub(TransferService, 'reconciliationTransferAbort')
    sandbox.stub(TransferService, 'getTransferStateChange')
    sandbox.stub(TransferService, 'getTransferState')
    sandbox.stub(TransferService, 'getTransferById')
    Utility.transformAccountToTopicName.returns(topicName)
    Utility.produceGeneralMessage.resolves()
    test.end()
  })

  adminHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  adminHandlerTest.test('createPrepareHandler should', async registerHandlersTest => {
    await registerHandlersTest.test('register all consumers on Kafka', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      DAO.retrieveAllParticipants.resolves(participants)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      const result = await adminHandler.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })
    await registerHandlersTest.test('register all consumers on Kafka', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      DAO.retrieveAllParticipants.resolves(participants)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      const result = await adminHandler.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    await registerHandlersTest.test('register all consumers on Kafka', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        DAO.retrieveAllParticipants.resolves(participants)
        Utility.transformGeneralTopicName.throws(new Error())
        Utility.getKafkaConfig.returns(config)
        await adminHandler.registerAllHandlers()
        test.fails('should throw')
        test.end()
      } catch (e) {
        test.ok('Error is thrown')
        test.end()
      }
    })

    registerHandlersTest.end()
  })

  adminHandlerTest.test('admin transfer should be able to', async transferTest => {
    await transferTest.test('Create new transfer for record funds', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()
        Kafka.Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).returns(true)
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)
        TransferService.validateDuplicateHash.withArgs(messages[0].value.content.payload).returns({
          existsMatching: 0,
          existingNotMatching: 0
        })

        const result = await adminHandler.transfer(null, Object.assign({}, messages[0]))
        Logger.info(result)
        test.ok(TransferService.reconciliationTransferPrepare.callsArgWith(0, trxStub))
        test.ok(TransferService.reconciliationTransferReserve.callsArgWith(0, trxStub))
        test.ok(TransferService.reconciliationTransferCommit.callsArgWith(0, trxStub))
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })

    await transferTest.test('throw error with wrong topic 2', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        let result = await adminHandler.transfer(null, messageProtocolWrongAction)
        test.ok(result, 'exits without error')
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })

    await transferTest.test('Should exit without error when topic is not found', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        Kafka.Consumer.getConsumer.withArgs(topicName).throws(new Error())
        let result = await adminHandler.transfer(null, Object.assign({}, messages[0]))
        test.ok(result, 'exits')
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })

    await transferTest.test('should catch error and rollback', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.rollback = sandbox.stub()
        Kafka.Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).throws(new Error())
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)

        TransferService.validateDuplicateHash.withArgs(messages[0].value.content.payload).returns({
          existsMatching: 0,
          existingNotMatching: 0
        })
        TransferService.reconciliationTransferPrepare.callsArgWith(0, trxStub).throws(new Error())
        await adminHandler.transfer(null, Object.assign({}, messages[0]))
        test.fail('should throw and rollback')
        test.end()
      } catch (e) {
        test.ok('Error is thrown')
        test.end()
      }
    })

    await transferTest.test('should catch error and rollback', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.rollback = sandbox.stub()
        Kafka.Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).throws(new Error())
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)

        TransferService.validateDuplicateHash.withArgs(messages[1].value.content.payload).returns({
          existsMatching: 0,
          existingNotMatching: 0
        })
        TransferService.reconciliationTransferPrepare.callsArgWith(0, trxStub).throws(new Error())
        await adminHandler.transfer(null, Object.assign({}, messages[1]))
        test.fail('should throw and rollback')
        test.end()
      } catch (e) {
        test.ok('Error is thrown')
        test.end()
      }
    })

    await transferTest.test('should catch error and rollback', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.rollback = sandbox.stub()
        Kafka.Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).throws(new Error())
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.throws(new Error())

        TransferService.validateDuplicateHash.withArgs(messages[0].value.content.payload).returns({
          existsMatching: 0,
          existingNotMatching: 0
        })
        TransferService.reconciliationTransferPrepare.callsArgWith(0, trxStub).throws(new Error())
        await adminHandler.transfer(null, Object.assign({}, messages[0]))
        test.fail('should throw and rollback')
        test.end()
      } catch (e) {
        test.ok('Error is thrown')
        test.end()
      }
    })

    await transferTest.test('Create new transfer for record funds if array of messages is consumed', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()
        Kafka.Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).returns(true)
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)

        TransferService.validateDuplicateHash.withArgs(messages[0].value.content.payload).returns({
          existsMatching: 0,
          existingNotMatching: 0
        })
        const result = await adminHandler.transfer(null, messages)
        Logger.info(result)
        test.ok(TransferService.reconciliationTransferPrepare.callsArgWith(0, trxStub))
        test.ok(TransferService.reconciliationTransferCommit.callsArgWith(0, trxStub))
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })

    await transferTest.test('Create erroneous msg', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()
        Kafka.Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).returns(true)
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)

        TransferService.validateDuplicateHash.withArgs(messages[0].value.content.payload).returns({
          existsMatching: 0,
          existingNotMatching: 0
        })
        const result = await adminHandler.transfer('ERROR', Object.assign({}, messages[0]))
        Logger.info(result)
        test.fail('should throw')
        test.end()
      } catch (e) {
        test.ok(`${e} error thrown`)
        test.end()
      }
    })

    await transferTest.test('throw error if payload is missing', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        Kafka.Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).returns(true)

        TransferService.validateDuplicateHash.withArgs(messages[0].value.content.payload).returns({
          existsMatching: 0,
          existingNotMatching: 0
        })
        let result = await adminHandler.transfer(null, Object.assign({}, messages[0], { value: { content: { payload: undefined } } }))
        test.equal(result, false)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    // 7
    await transferTest.test('Create new transfer for record funds', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)

        TransferService.validateDuplicateHash.withArgs(messages[1].value.content.payload).returns({
          existsMatching: 0,
          existingNotMatching: 0
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messages[1]))
        Logger.info(result)
        test.ok(TransferService.reconciliationTransferCommit.callsArgWith(0, trxStub))
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    // test 8
    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.validateDuplicateHash.withArgs(messages[1].value.content.payload).returns({
          existsMatching: 0,
          existsNotMatching: 1
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messages[1]))
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })

    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        TransferService.validateDuplicateHash.withArgs(messages[1].value.content.payload).returns({
          existsMatching: 1,
          existingNotMatching: 0
        })
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messages[1]))
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    // test 9
    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        TransferService.validateDuplicateHash.withArgs(messages[1].value.content.payload).returns({
          existsMatching: 1,
          existingNotMatching: 0
        })
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.ABORTED_REJECTED
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messages[1]))
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    // test 10
    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        TransferService.validateDuplicateHash.withArgs(messages[1].value.content.payload).returns({
          existsMatching: 1,
          existingNotMatching: 0
        })
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messages[1]))
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    // test 11
    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        TransferService.validateDuplicateHash.withArgs(messages[1].value.content.payload).returns({
          existsMatching: 1,
          existingNotMatching: 0
        })
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.RESERVED
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messages[1]))
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    // test 11a
    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        TransferService.validateDuplicateHash.withArgs(messages[1].value.content.payload).returns({
          existsMatching: 1,
          existingNotMatching: 0
        })
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.FAILED
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messages[1]))
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    // test 12
    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        TransferService.validateDuplicateHash.withArgs(messages[1].value.content.payload).returns({
          existsMatching: 1,
          existingNotMatching: 0
        })
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({})
        const result = await adminHandler.transfer(null, Object.assign({}, messages[1]))
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    // test 13
    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.getTransferState.withArgs(messages[2].value.content.id).returns({
          enumeration: TransferState.COMMITTED
        })
        TransferService.validateDuplicateHash.withArgs(messages[2].value.content.payload).returns({
          existsMatching: 1,
          existingNotMatching: 0
        })
        TransferService.getTransferById.withArgs(messages[2].value.content.id)
          .returns(Object.assign({},
            messages[1].value.content.payload,
            { expirationDate: '2016-05-24T08:38:08.699-04:00' }))
        TransferService.getTransferState.withArgs(messages[2].value.content.id).returns({
          transferStateId: TransferState.RESERVED
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messages[2]))
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    // test 14
    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.getTransferState.withArgs(messages[2].value.content.id).returns({
          enumeration: TransferState.COMMITTED
        })
        TransferService.validateDuplicateHash.withArgs(messages[2].value.content.payload).returns({
          existsMatching: 1,
          existingNotMatching: 0
        })
        TransferService.getTransferById.withArgs(messages[2].value.content.id)
          .returns(Object.assign({},
            messages[1].value.content.payload))
        TransferService.getTransferState.withArgs(messages[2].value.content.id).returns({
          transferStateId: TransferState.RESERVED
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messages[2]))
        Logger.info(result)
        test.equal(result, true)
        test.ok(TransferService.reconciliationTransferCommit.callsArgWith(0, messages[1].value.content.payload), 'transferService.reconciliationTransferCommit Called')
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    // test 16
    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.getTransferState.withArgs(messages[3].value.content.id).returns({
          enumeration: TransferState.COMMITTED
        })
        TransferService.validateDuplicateHash.withArgs(messages[3].value.content.payload).returns({
          existsMatching: 1,
          existingNotMatching: 0
        })
        TransferService.getTransferById.withArgs(messages[3].value.content.id)
          .returns(Object.assign({},
            messages[1].value.content.payload))
        TransferService.getTransferState.withArgs(messages[3].value.content.id).returns({
          transferStateId: TransferState.RESERVED
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messages[3]))
        Logger.info(result)
        test.equal(result, true)
        test.ok(TransferService.reconciliationTransferAbort.callsArgWith(0, messages[3].value.content.payload), 'transferService.reconciliationTransferAbort Called')
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.getTransferState.withArgs(messageProtocolWrongAction.value.content.id).returns({
          enumeration: TransferState.COMMITTED
        })
        TransferService.validateDuplicateHash.withArgs(messageProtocolWrongAction.value.content.payload).returns({
          existsMatching: 1,
          existingNotMatching: 0
        })
        TransferService.getTransferById.withArgs(messageProtocolWrongAction.value.content.id)
          .returns(Object.assign({},
            messages[1].value.content.payload))
        TransferService.getTransferState.withArgs(messageProtocolWrongAction.value.content.id).returns({
          transferStateId: TransferState.RESERVED
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messageProtocolWrongAction))
        Logger.info(result)
        test.equal(result, true)
        test.ok(TransferService.reconciliationTransferAbort.callsArgWith(0, messageProtocolWrongAction.value.content.payload), 'transferService.reconciliationTransferAbort Called')
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.getTransferState.withArgs(messages[3].value.content.id).returns({
          enumeration: TransferState.COMMITTED
        })
        TransferService.validateDuplicateHash.withArgs(messages[3].value.content.payload).returns({
          existsMatching: 1,
          existingNotMatching: 0
        })
        TransferService.getTransferById.withArgs(messages[3].value.content.id)
          .returns(Object.assign({},
            messages[1].value.content.payload))
        TransferService.getTransferState.withArgs(messages[3].value.content.id).returns({
          transferStateId: 'NOT_RESERVED'
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messages[3]))
        Logger.info(result)
        test.equal(result, true)
        test.ok(TransferService.reconciliationTransferAbort.callsArgWith(0, messages[3].value.content.payload), 'transferService.reconciliationTransferAbort Called')
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    // test 18
    await transferTest.test('Do not create new transfer for record funds if transfer already exists', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferService.validateDuplicateHash.withArgs(messages[3].value.content.payload).returns({
          existsMatching: 0,
          existingNotMatching: 1
        })
        const result = await adminHandler.transfer(null, Object.assign({}, messages[3]))
        Logger.info(result)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    transferTest.end()
  })
  adminHandlerTest.end()
})
