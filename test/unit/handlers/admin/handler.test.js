'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const AdminHandler = require('../../../../src/handlers/admin/handler')
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const KafkaConsumer = Consumer.Consumer
const { randomUUID } = require('crypto')
const Logger = require('../../../../src/shared/logger').logger
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const TransferService = require('../../../../src/domain/transfer')
const Db = require('../../../../src/lib/db')
const ProxyCache = require('#src/lib/proxyCache')
const Enum = require('@mojaloop/central-services-shared').Enum
const TransferState = Enum.Transfers.TransferState
const TransferInternalState = Enum.Transfers.TransferInternalState

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

const currentDate = new Date()
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
  expirationDate: new Date(currentDate.setDate(currentDate.getDate() + 1)),
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
      id: randomUUID(),
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
      id: randomUUID(),
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
      id: randomUUID(),
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
      id: randomUUID(),
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
        id: randomUUID(),
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
    mode: 2,
    batchSize: 1,
    pollFrequency: 10,
    recursiveTimeout: 100,
    messageCharset: 'utf8',
    messageAsJSON: true,
    sync: true,
    consumeTimeout: 1000
  },
  rdkafkaConf: {
    'client.id': 'kafka-test',
    debug: 'all',
    'group.id': 'central-ledger-kafka',
    'metadata.broker.list': 'localhost:9092',
    'enable.auto.commit': false
  }
}

const command = () => {
}

Test('Admin handler', adminHandlerTest => {
  let sandbox

  adminHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(ProxyCache, 'getCache').returns({
      connect: sandbox.stub(),
      disconnect: sandbox.stub()
    })
    sandbox.stub(KafkaConsumer.prototype, 'constructor').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'connect').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'consume').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').resolves()
    sandbox.stub(Consumer, 'getConsumer').returns({
      commitMessageSync: async function () { return Promise.resolve(true) }
    })
    sandbox.stub(Consumer, 'isConsumerAutoCommitEnabled')
    sandbox.stub(TransferService, 'reconciliationTransferPrepare')
    sandbox.stub(TransferService, 'reconciliationTransferReserve')
    sandbox.stub(TransferService, 'reconciliationTransferCommit')
    sandbox.stub(TransferService, 'reconciliationTransferAbort')
    sandbox.stub(TransferService, 'recordFundsIn')
    sandbox.stub(TransferService, 'getTransferStateChange')
    sandbox.stub(TransferService, 'getTransferState')
    sandbox.stub(TransferService, 'getTransferById')
    sandbox.stub(Kafka)
    sandbox.stub(Comparators)
    Kafka.transformAccountToTopicName.returns(topicName)
    Kafka.produceGeneralMessage.resolves()
    test.end()
  })

  adminHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  adminHandlerTest.test('createPrepareHandler should', async registerHandlersTest => {
    await registerHandlersTest.test('register all consumers on Kafka', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Kafka.getKafkaConfig.returns(config)
      const result = await AdminHandler.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    await registerHandlersTest.test('register all consumers on Kafka', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.throws(new Error())
        Kafka.getKafkaConfig.returns(config)
        await AdminHandler.registerAllHandlers()
        test.fail('should throw')
        test.end()
      } catch (e) {
        test.ok('Error is thrown')
        test.end()
      }
    })

    registerHandlersTest.end()
  })

  adminHandlerTest.test('admin transfer should', async transferTest => {
    await transferTest.test('create new transfer for record funds in', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()
        Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).returns(true)
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)
        const payload = messages[0].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: false,
          hasDuplicateHash: false
        }))

        const result = await AdminHandler.transfer(null, Object.assign({}, messages[0]))
        Logger.info(result)
        test.ok(TransferService.recordFundsIn.callsArgWith(0, trxStub))
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })

    await transferTest.test('throw error with wrong topic 2', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        const result = await AdminHandler.transfer(null, messageProtocolWrongAction)
        test.ok(result, 'exits without error')
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })

    await transferTest.test('catch error and rollback', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.rollback = () => Promise.reject(new Error('DB Error'))

        Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).throws(new Error())
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)

        const payload = messages[0].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: false,
          hasDuplicateHash: false
        }))
        TransferService.recordFundsIn.callsArgWith(0, trxStub).throws(new Error())
        await AdminHandler.transfer(null, Object.assign({}, messages[0]))
        test.fail('Error is not thrown!')
        test.end()
      } catch (e) {
        test.ok('Error is thrown')
        test.end()
      }
    })

    await transferTest.test('catch error and rollback', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.rollback = () => Promise.reject(new Error('DB Error'))
        Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).throws(new Error())
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)

        const payload = messages[1].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: false,
          hasDuplicateHash: false
        }))
        TransferService.reconciliationTransferPrepare.callsArgWith(0, trxStub).throws(new Error())
        await AdminHandler.transfer(null, Object.assign({}, messages[1]))
        test.fail('Error is not thrown!')
        test.end()
      } catch (e) {
        test.ok('Error is thrown')
        test.end()
      }
    })

    await transferTest.test('create new transfer for record funds if array of messages is consumed', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()
        Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).returns(true)
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)
        const payload = messages[0].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: false,
          hasDuplicateHash: false
        }))
        const result = await AdminHandler.transfer(null, messages)
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

    await transferTest.test('create erroneous msg', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()
        Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).returns(true)
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)
        const payload = messages[0].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: false,
          hasDuplicateHash: false
        }))
        const result = await AdminHandler.transfer('ERROR', Object.assign({}, messages[0]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        Consumer.isConsumerAutoCommitEnabled.withArgs(topicName).returns(true)
        const payload = messages[0].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: false,
          hasDuplicateHash: false
        }))
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[0], { value: { content: { payload: undefined } } }))
        test.equal(result, false)
        test.end()
      } catch (e) {
        test.fail(`${e} error thrown`)
        test.end()
      }
    })
    // 7
    await transferTest.test('create new transfer for record funds', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        sandbox.stub(Db, 'getKnex')
        const knexStub = sandbox.stub()
        const trxStub = sandbox.stub()
        trxStub.commit = sandbox.stub()
        knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
        Db.getKnex.returns(knexStub)
        const payload = messages[1].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: false,
          hasDuplicateHash: false
        }))
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[1]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        const payload = messages[1].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: false
        }))
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[1]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const payload = messages[1].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: true
        }))
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[1]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const payload = messages[1].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: true
        }))
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferInternalState.ABORTED_REJECTED
        })
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[1]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const payload = messages[1].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: true
        }))
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[1]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const payload = messages[1].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: true
        }))
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.RESERVED
        })
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[1]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const payload = messages[1].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: true
        }))
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferInternalState.FAILED
        })
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[1]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const payload = messages[1].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: true
        }))
        TransferService.getTransferStateChange.withArgs(messages[1].value.id).returns({})
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[1]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        TransferService.getTransferState.withArgs(messages[2].value.content.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const payload = messages[2].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: true
        }))
        TransferService.getTransferById.withArgs(messages[2].value.content.id)
          .returns(Object.assign({},
            messages[1].value.content.payload,
            { expirationDate: '2016-05-24T08:38:08.699-04:00' }))
        TransferService.getTransferState.withArgs(messages[2].value.content.id).returns({
          transferStateId: TransferState.RESERVED
        })
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[2]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        TransferService.getTransferState.withArgs(messages[2].value.content.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const payload = messages[2].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: true
        }))
        TransferService.getTransferById.withArgs(messages[2].value.content.id)
          .returns(Object.assign({},
            messages[1].value.content.payload))
        TransferService.getTransferState.withArgs(messages[2].value.content.id).returns({
          transferStateId: TransferState.RESERVED
        })
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[2]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        TransferService.getTransferState.withArgs(messages[3].value.content.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const payload = messages[3].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: true
        }))
        TransferService.getTransferById.withArgs(messages[3].value.content.id)
          .returns(Object.assign({},
            messages[1].value.content.payload))
        TransferService.getTransferState.withArgs(messages[3].value.content.id).returns({
          transferStateId: TransferState.RESERVED
        })
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[3]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        TransferService.getTransferState.withArgs(messageProtocolWrongAction.value.content.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const payload = messageProtocolWrongAction.value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: true
        }))
        TransferService.getTransferById.withArgs(messageProtocolWrongAction.value.content.id)
          .returns(Object.assign({},
            messages[1].value.content.payload))
        TransferService.getTransferState.withArgs(messageProtocolWrongAction.value.content.id).returns({
          transferStateId: TransferState.RESERVED
        })
        const result = await AdminHandler.transfer(null, Object.assign({}, messageProtocolWrongAction))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        TransferService.getTransferState.withArgs(messages[3].value.content.id).returns({
          enumeration: TransferState.COMMITTED
        })
        const payload = messages[3].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: true
        }))
        TransferService.getTransferById.withArgs(messages[3].value.content.id)
          .returns(Object.assign({},
            messages[1].value.content.payload))
        TransferService.getTransferState.withArgs(messages[3].value.content.id).returns({
          transferStateId: 'NOT_RESERVED'
        })
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[3]))
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
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        const payload = messages[3].value.content.payload
        Comparators.duplicateCheckComparator.withArgs(transfer.transferId, payload).returns(Promise.resolve({
          hasDuplicateId: true,
          hasDuplicateHash: false
        }))
        const result = await AdminHandler.transfer(null, Object.assign({}, messages[3]))
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
