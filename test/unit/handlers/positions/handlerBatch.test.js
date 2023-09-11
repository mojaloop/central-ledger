'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const BinProcessor = require('../../../../src/domain/position/binProcessor')
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const KafkaConsumer = Consumer.Consumer
const BatchPositionModel = require('../../../../src/models/position/batch')
const Enum = require('@mojaloop/central-services-shared').Enum
const Proxyquire = require('proxyquire')

const topicName = 'topic-transfer-position-batch'

const prepareMessageValue = {
  metadata: {
    event: {
      action: Enum.Events.Event.Action.PREPARE
    }
  }
}
const commitMessageValue = {
  metadata: {
    event: {
      action: Enum.Events.Event.Action.COMMIT
    }
  }
}

const samplePrepareMessages = [
  {
    key: '1001',
    value: prepareMessageValue,
    topic: topicName
  },
  {
    key: '1001',
    value: prepareMessageValue,
    topic: topicName
  },
  {
    key: '1002',
    value: prepareMessageValue,
    topic: topicName
  },
];

const sampleCommitMessages = [
  {
    key: '1001',
    value: commitMessageValue,
    topic: topicName
  },
  {
    key: '1002',
    value: commitMessageValue,
    topic: topicName
  },
];

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

const command = () => {}

let SpanStub
let allTransferHandlers
let trxStub
let messages
let expectedBins

Test('Position handler', transferHandlerTest => {
  let sandbox

  transferHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    SpanStub = {
      audit: sandbox.stub().callsFake(),
      error: sandbox.stub().callsFake(),
      finish: sandbox.stub().callsFake(),
      setTags: sandbox.stub().callsFake()
    }

    // Mixed messages
    messages = [
      samplePrepareMessages[0],
      samplePrepareMessages[1],
      sampleCommitMessages[0],
      samplePrepareMessages[2],
      sampleCommitMessages[1]
    ]

    expectedBins = {
      1001: {
        prepare: [
          {
            message: samplePrepareMessages[0],
            span: SpanStub,
          },
          {
            message: samplePrepareMessages[1],
            span: SpanStub,
          },
        ],
        commit: [
          {
            message: sampleCommitMessages[0],
            span: SpanStub,
          },
        ],
      },
      1002: {
        prepare: [
          {
            message: samplePrepareMessages[2],
            span: SpanStub,
          },
        ],
        commit: [
          {
            message: sampleCommitMessages[1],
            span: SpanStub,
          },
        ],
      },
    }

    const TracerStub = {
      extractContextFromMessage: sandbox.stub().callsFake(() => {
        return {}
      }),
      createChildSpanFromContext: sandbox.stub().callsFake(() => {
        return SpanStub
      })
    }

    const EventSdkStub = {
      Tracer: TracerStub
    }

    allTransferHandlers = Proxyquire('../../../../src/handlers/positions/handlerBatch', {
      '@mojaloop/event-sdk': EventSdkStub
    })

    sandbox.stub(Kafka)
    sandbox.stub(KafkaConsumer.prototype, 'constructor').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'connect').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'consume').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').resolves()
    sandbox.stub(Consumer, 'getConsumer').returns({
      commitMessageSync: async function () { return true }
    })
    sandbox.stub(BatchPositionModel)
    trxStub = {
      commit: sandbox.stub().returns(true),
      rollback: sandbox.stub().returns(true)
    }
    BatchPositionModel.startDbTransaction.returns(trxStub)
    sandbox.stub(BinProcessor)
    BinProcessor.processBins.resolves({
      notifyMessages: messages.map((i) => ({binItem: {message: i, span: SpanStub}}))
    })
    BinProcessor.iterateThroughBins.restore()
    // BinProcessor.iterateThroughBins.callsFake(async (bins, callback) => {
    //   for (const accountBin of Object.values(bins)) {
    //     for (const actionBin of Object.values(accountBin)) {
    //       for (const item of actionBin) {
    //         await callback(item);
    //       }
    //     }
    //   }
    // })
    Kafka.transformAccountToTopicName.returns(topicName)
    Kafka.produceGeneralMessage.resolves()
    test.end()
  })

  transferHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  transferHandlerTest.test('createPrepareHandler should', registerHandlersTest => {
    registerHandlersTest.test('register all consumers on Kafka', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Kafka.getKafkaConfig.returns(config)

      const result = await allTransferHandlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('register a consumer on Kafka', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Kafka.getKafkaConfig.returns(config)
      const result = await allTransferHandlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('throw error when there is an error getting KafkaConfig', async (test) => {
      try {
        Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())

        await allTransferHandlers.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })


    registerHandlersTest.test('registerPrepareHandler throw error when there is an error getting KafkaConfig', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())

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

  transferHandlerTest.test('positions should', positionsTest => {
    
    positionsTest.test('process messages and commit Kafka offset and DB transaction', async test => {
      // Arrange
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Kafka.getKafkaConfig.returns(config)
      Kafka.proceed.returns(true)

      // Act
      try {
        await allTransferHandlers.positions(null, messages)
        test.ok(BatchPositionModel.startDbTransaction.calledOnce, 'startDbTransaction should be called once');
        test.ok(BinProcessor.processBins.calledOnceWithExactly(expectedBins, trxStub), 'processBins should be called once with bins and trx');
        const expectedLastMessageToCommit = messages[messages.length - 1];
        test.equal(Kafka.proceed.getCall(0).args[1].message.offset, expectedLastMessageToCommit.offset, 'kafkaProceed should be called with the correct offset');
        test.equal(SpanStub.audit.callCount, 5, 'span.audit should be called five times');
        test.equal(SpanStub.finish.callCount, 5, 'span.finish should be called five times');
        test.ok(trxStub.commit.calledOnce, 'trx.commit should be called once');
        test.ok(trxStub.rollback.notCalled, 'trx.rollback should not be called');
        test.equal(Kafka.produceGeneralMessage.callCount, 5, 'produceGeneralMessage should be five times to produce kafka notification events');
        test.end()
      } catch (err) {
        test.fail('Error should not be thrown')
        test.end()
      }
    })

    positionsTest.test('rollback DB transaction and audit error if BinProcessor fails', async test => {
      // Arrange
      BinProcessor.processBins.rejects(new Error('BinProcessor failed'))
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Kafka.getKafkaConfig.returns(config)
      Kafka.proceed.returns(true)

      // Act
      try {
        await allTransferHandlers.positions(null, messages)
        test.ok(BatchPositionModel.startDbTransaction.calledOnce, 'startDbTransaction should be called once');
        test.ok(BinProcessor.processBins.calledOnceWithExactly(expectedBins, trxStub), 'processBins should be called once with bins and trx');
        test.ok(Kafka.proceed.notCalled, 'kafkaProceed should not be called');
        test.equal(SpanStub.audit.callCount, 5, 'span.audit should be called five times');
        test.equal(SpanStub.error.callCount, 5, 'span.error should be called five times');
        test.equal(SpanStub.finish.callCount, 5, 'span.finish should be called five times');
        test.ok(Kafka.produceGeneralMessage.notCalled, 'produceGeneralMessage should not be called');
        test.ok(trxStub.rollback.calledOnce, 'trx.rollback should be called once');
        test.ok(trxStub.commit.notCalled, 'trx.commit should not be called');
        test.end()
      } catch (err) {
        test.fail('Error should not be thrown')
        test.end()
      }
    })

    positionsTest.end()
  })

  transferHandlerTest.end()
})
