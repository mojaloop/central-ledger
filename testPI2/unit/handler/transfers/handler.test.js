'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const allTransferHandlers = require('../../../../src/handlers/transfers/handler')
const Kafka = require('../../../../src/handlers/lib/kafka')
const Validator = require('../../../../src/handlers/transfers/validator')
const TransferQueries = require('../../../../src/domain/transfer/queries')
const TransferDomain = require('../../../../src/domain/transfer')
const Utility = require('../../../../src/handlers/lib/utility')
const moment = require('moment')
const Uuid = require('uuid4')
const KafkaConsumer = require('@mojaloop/central-services-shared').Kafka.Consumer
const Consumer = require('../../../../src/handlers/lib/kafka/consumer')
const DAO = require('../../../../src/handlers/lib/dao')
const Logger = require('@mojaloop/central-services-shared').Logger

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

const messages = [
  {
    value: messageProtocol
  }
]

const topicName = 'topic-test'

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

const command = () => {}

const error = () => { throw new Error() }

const participants = ['testName1', 'testName2']

Test('Transfer handler', transferHandlerTest => {
  let sandbox

  transferHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(DAO)
    sandbox.stub(KafkaConsumer.prototype, 'constructor').returns(P.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'connect').returns(P.resolve())
    // sandbox.stub(KafkaConsumer.prototype, 'consume').callsArgWithAsync(0, null, messages).returns(P.resolve())
    // sandbox.stub(KafkaConsumer.prototype, 'consume').callThrough().returns(P.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').returns(P.resolve())
    sandbox.stub(Validator)
    sandbox.stub(TransferQueries)
    sandbox.stub(TransferDomain)
    sandbox.stub(Utility)
    Utility.produceGeneralMessage.returns(P.resolve())
    test.end()
  })

  transferHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  transferHandlerTest.test('prepare should', prepareTest => {
    // prepareTest.test('persist transfer to database when messages is an array', async (test) => {
    //   await Consumer.createHandler(topicName, config, command)
    //   Utility.transformAccountToTopicName.returns(topicName)
    //   Validator.validateByName.returns({validationPassed: true, reasons: []})
    //   TransferQueries.getById.returns(P.resolve(null))
    //   TransferDomain.prepare.returns(P.resolve(true))
    //   const result = await allTransferHandlers.prepare(null, messages)
    //   test.equal(result, true)
    //   test.end()
    // })
    //
    // prepareTest.test('persist transfer to database when single message sent', async (test) => {
    //   await Consumer.createHandler(topicName, config, command)
    //   Utility.transformAccountToTopicName.returns(topicName)
    //   Validator.validateByName.returns({validationPassed: true, reasons: []})
    //   TransferQueries.getById.returns(P.resolve(null))
    //   TransferDomain.prepare.returns(P.resolve(true))
    //   const result = await allTransferHandlers.prepare(null, messages[0])
    //   test.equal(result, true)
    //   test.end()
    // })
    //
    // prepareTest.test('not persist duplicate transfer to database', async (test) => {
    //   await Consumer.createHandler(topicName, config, command)
    //   Utility.transformAccountToTopicName.returns(topicName)
    //   Validator.validateByName.returns({validationPassed: true, reasons: []})
    //   TransferQueries.getById.returns(P.resolve({}))
    //   TransferDomain.prepare.returns(P.resolve(true))
    //   const result = await allTransferHandlers.prepare(null, messages)
    //   test.equal(result, true)
    //   test.end()
    // })
    //
    // prepareTest.test('fail validation and persist REJECTED transfer to database', async (test) => {
    //   await Consumer.createHandler(topicName, config, command)
    //   Utility.transformAccountToTopicName.returns(topicName)
    //   Validator.validateByName.returns({validationPassed: false, reasons: []})
    //   TransferQueries.getById.returns(P.resolve(null))
    //   TransferDomain.prepare.returns(P.resolve(true))
    //   const result = await allTransferHandlers.prepare(null, messages)
    //   test.equal(result, true)
    //   test.end()
    // })
    //
    // prepareTest.test('fail validation and duplicate entry should be updated to REJECTED and persisted to database', async (test) => {
    //   await Consumer.createHandler(topicName, config, command)
    //   Utility.transformAccountToTopicName.returns(topicName)
    //   Validator.validateByName.returns({validationPassed: false, reasons: []})
    //   TransferQueries.getById.returns(P.resolve({}))
    //   TransferDomain.reject.returns(P.resolve(true))
    //   const result = await allTransferHandlers.prepare(null, messages)
    //   test.equal(result, true)
    //   test.end()
    // })
    //
    // prepareTest.test('throw an error when an error is by prepare', async (test) => {
    //   try {
    //     await Consumer.createHandler(topicName, config, command)
    //     Utility.transformAccountToTopicName.returns(topicName)
    //     Validator.validateByName.returns({validationPassed: true, reasons: []})
    //     TransferQueries.getById.returns(P.resolve(null))
    //     TransferDomain.prepare.throws(new Error)
    //     await allTransferHandlers.prepare(null, messages)
    //     test.fail('No Error Thrown')
    //     test.end()
    //   } catch (e) {
    //     test.pass('Error Thrown')
    //     test.end()
    //   }
    // })
    //
    // prepareTest.test('throw an error when consumer not found', async (test) => {
    //   try {
    //     await Consumer.createHandler(topicName, config, command)
    //     Utility.transformAccountToTopicName.returns('invalid-topic')
    //     await allTransferHandlers.prepare(null, messages)
    //     test.fail('No Error Thrown')
    //     test.end()
    //   } catch (e) {
    //     test.pass('Error Thrown')
    //     test.end()
    //   }
    // })
    //
    // prepareTest.test('throw an error when an error is thrown from Kafka', async (test) => {
    //   try {
    //     await allTransferHandlers.prepare(error, null)
    //     test.fail('No Error Thrown')
    //     test.end()
    //   } catch (e) {
    //     test.pass('Error Thrown')
    //     test.end()
    //   }
    // })

    prepareTest.test('test async call back', async (test) => {
      // setup spies
      var spyForAllTransferHandlersPrepare = Sinon.spy(allTransferHandlers, 'prepare')

      // setup stubs
      Utility.transformAccountToTopicName.returns(topicName)
      Validator.validateByName.returns({validationPassed: true, reasons: []})
      TransferQueries.getById.returns(P.resolve(null))
      TransferDomain.prepare.returns(P.resolve(true))

      var testFunc = (str1, str2) => {
        var result = `${str1}.world.${str2}`
        console.log(result)
        return result
      }

      var testClassCallback = {
        run: function (var1) {
          // logic that is going to DB
          console.log(`testClassCallback - ${var1('hello', 'john')}`)
          // console.log(var1('hello', 'john'))
          return var1('hello', 'john')
        }
      }

      console.log('1!!!')
      console.log(`1- testClassCallback.run(testFunc) = ${testClassCallback.run(testFunc)}`)

      // sandbox.stub(testClassCallback, 'run').returns(false).callsArgWith(0, 'test', 'bleh')
      sandbox.stub(testClassCallback, 'run').returns(false).yields('test', 'bleh')

      console.log('2!!!')
      console.log(`2- testClassCallback.run(testFunc) = ${testClassCallback.run(testFunc)}`)

      // process.exit(0)

      // var stubKafkaConsumerPrototypeConsume = sandbox.stub(KafkaConsumer.prototype, 'consume').callsArgWith(0, [null, messages]).returns(P.resolve())
      console.log('stubbing the stuff')
      var stubKafkaConsumerPrototypeConsume = sandbox.stub(KafkaConsumer.prototype, 'consume').callsArgWith(0, null, messages)
      // var stubKafkaConsumerPrototypeConsume = sandbox.stub(KafkaConsumer.prototype, 'consume').returns(P.reject(true)).yields(null, messages)

      await Consumer.createHandler(topicName, config, command)
      var result = false

      // result = await allTransferHandlers.prepare(null, messages[0])

      var startTime = moment()
      var targetProcessingTimeInSeconds = 10
      var elapsedSeconds = 0
      let isAllTransferHandlersPrepareCalled = false

      while (elapsedSeconds < targetProcessingTimeInSeconds) {
        elapsedSeconds = moment().diff(startTime, 'seconds')
        Logger.debug(`elapsedSeconds...${elapsedSeconds}`)
        isAllTransferHandlersPrepareCalled = spyForAllTransferHandlersPrepare.called
        if (isAllTransferHandlersPrepareCalled) {
          result = await spyForAllTransferHandlersPrepare.returnValues[0]
          break
        }
      }

      test.equal(isAllTransferHandlersPrepareCalled, true, 'prepare callback was executed')
      test.equal(result, true, `prepare callback was executed returned ${result}`)
      test.end()
      spyForAllTransferHandlersPrepare.restore()
    })

    prepareTest.end()
  })

  // transferHandlerTest.test('transfer should', transferTest => {
  //   transferTest.test('produce a message to the notifications topic', async (test) => {
  //     await Consumer.createHandler(topicName, config, command)
  //     Utility.transformGeneralTopicName.returns(topicName)
  //     const result = await allTransferHandlers.transfer(null, messages)
  //     test.equal(result, true)
  //     test.end()
  //   })
  //
  //   transferTest.test('create notification when single message sent', async (test) => {
  //     await Consumer.createHandler(topicName, config, command)
  //     Utility.transformGeneralTopicName.returns(topicName)
  //     const result = await allTransferHandlers.transfer(null, messages[0])
  //     test.equal(result, true)
  //     test.end()
  //   })
  //
  //   transferTest.test('throw an error when an error is by transfer', async (test) => {
  //     try {
  //       await Consumer.createHandler(topicName, config, command)
  //       Utility.transformGeneralTopicName.throws(new Error)
  //       await allTransferHandlers.transfer(null, messages)
  //       test.fail('No Error Thrown')
  //       test.end()
  //     } catch (e) {
  //       test.pass('Error Thrown')
  //       test.end()
  //     }
  //   })
  //
  //   transferTest.test('throw an error when an error is thrown from Kafka', async (test) => {
  //     try {
  //       await allTransferHandlers.transfer(error, null)
  //       test.fail('No Error Thrown')
  //       test.end()
  //     } catch (e) {
  //       test.pass('Error Thrown')
  //       test.end()
  //     }
  //   })
  //
  //   transferTest.end()
  // })

  //
  // transferHandlerTest.test('createPrepareHandler should', registerHandlersTest => {
  //   registerHandlersTest.test('register all consumers on Kafka', async (test) => {
  //     await Kafka.Consumer.createHandler(topicName, config, command)
  //     DAO.retrieveAllParticipants.returns(P.resolve(participants))
  //     Utility.transformAccountToTopicName.returns(topicName)
  //     Utility.transformGeneralTopicName.returns(topicName)
  //     Utility.getKafkaConfig.returns(config)
  //     const result = await allTransferHandlers.registerAllHandlers()
  //     test.equal(result, true)
  //     test.end()
  //   })
  //
  //   registerHandlersTest.test('register a consumer on Kafka', async (test) => {
  //     await Kafka.Consumer.createHandler(topicName, config, command)
  //     Utility.transformAccountToTopicName.returns(topicName)
  //     Utility.transformGeneralTopicName.returns(topicName)
  //     Utility.getKafkaConfig.returns(config)
  //     await DAO.retrieveAllParticipants.returns(P.resolve(participants))
  //     const result = await allTransferHandlers.registerAllHandlers()
  //     test.equal(result, true)
  //     test.end()
  //   })
  //
  //   registerHandlersTest.test('throws error retrieveAllParticipants', async (test) => {
  //     try {
  //       Kafka.Consumer.createHandler(topicName, config, command)
  //       await DAO.retrieveAllParticipants.returns(P.resolve(participants))
  //       Utility.transformAccountToTopicName.returns(topicName)
  //       Utility.transformGeneralTopicName.returns(topicName)
  //       Utility.getKafkaConfig.throws(new Error)
  //       await allTransferHandlers.registerAllHandlers()
  //       test.fail('Error not thrown')
  //       test.end()
  //     } catch (e) {
  //       test.pass('Error thrown')
  //       test.end()
  //     }
  //   })
  //
  //   registerHandlersTest.test('throws error registerFulfillHandler', async (test) => {
  //     try {
  //       Kafka.Consumer.createHandler(topicName, config, command)
  //       Utility.transformGeneralTopicName.returns(topicName)
  //       Utility.getKafkaConfig.throws(new Error)
  //       await allTransferHandlers.registerFulfillHandler()
  //       test.fail('Error not thrown')
  //       test.end()
  //     } catch (e) {
  //       test.pass('Error thrown')
  //       test.end()
  //     }
  //   })
  //
  //   registerHandlersTest.test('throws error registerRejectHandler', async (test) => {
  //     try {
  //       Kafka.Consumer.createHandler(topicName, config, command)
  //       Utility.transformGeneralTopicName.returns(topicName)
  //       Utility.getKafkaConfig.throws(new Error)
  //       await allTransferHandlers.registerRejectHandler()
  //       test.fail('Error not thrown')
  //       test.end()
  //     } catch (e) {
  //       test.pass('Error thrown')
  //       test.end()
  //     }
  //   })
  //
  //   registerHandlersTest.test('throws error registerTransferHandler', async (test) => {
  //     try {
  //       Kafka.Consumer.createHandler(topicName, config, command)
  //       Utility.transformGeneralTopicName.returns(topicName)
  //       Utility.getKafkaConfig.throws(new Error)
  //       await allTransferHandlers.registerTransferHandler()
  //       test.fail('Error not thrown')
  //       test.end()
  //     } catch (e) {
  //       test.pass('Error thrown')
  //       test.end()
  //     }
  //   })
  //
  //   registerHandlersTest.end()
  // })

  transferHandlerTest.end()
})
