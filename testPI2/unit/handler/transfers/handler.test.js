'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const transferHandler = require('../../../../src/handlers/transfers/handler')
const Kafka = require('../../../../src/handlers/lib/kafka')
const Validator = require('../../../../src/handlers/transfers/validator')
const TransferQueries = require('../../../../src/domain/transfer/queries')
const TransferHandler = require('../../../../src/domain/transfer')
const Utility = require('../../../../src/handlers/lib/utility')
const Uuid = require('uuid4')
const KafkaConsumer = require('@mojaloop/central-services-shared').Kafka.Consumer
const Consumer = require('../../../../src/handlers/lib/kafka/consumer')

const transfer = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'dfsp1',
  payeeFsp: 'dfsp2',
  amount:
    {
      currency: 'USD',
      amount: '433.88'
    },
  ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
  condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
  expiration: '2016-05-24T08:38:08.699-04:00',
  extensionList:
    {
      extension:
        [
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

const config = {}

const command = () => {}

const error = () => {throw new Error()}

Test('Transfer handler', transferHandlerTest => {
  let sandbox

  transferHandlerTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(KafkaConsumer.prototype, 'constructor').returns(P.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'connect').returns(P.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'consume').returns(P.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').returns(P.resolve())
    sandbox.stub(Validator)
    sandbox.stub(TransferQueries)
    sandbox.stub(TransferHandler)
    sandbox.stub(Utility)
    Utility.transformAccountToTopicName.returns(topicName)
    Utility.produceGeneralMessage.returns(P.resolve())
    test.end()
  })

  transferHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  transferHandlerTest.test('prepare should', prepareTest => {

    prepareTest.test('persist transfer to database when messages is an array', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Validator.validateByName.returns({validationPassed: true, reasons: []})
      TransferQueries.getById.returns(P.resolve(null))
      TransferHandler.prepare.returns(P.resolve(true))
      const result = await transferHandler.prepare(null, messages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when single message sent', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Validator.validateByName.returns({validationPassed: true, reasons: []})
      TransferQueries.getById.returns(P.resolve(null))
      TransferHandler.prepare.returns(P.resolve(true))
      const result = await transferHandler.prepare(null, messages[0])
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('not persist duplicate transfer to database', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Validator.validateByName.returns({validationPassed: true, reasons: []})
      TransferQueries.getById.returns(P.resolve({}))
      TransferHandler.prepare.returns(P.resolve(true))
      const result = await transferHandler.prepare(null, messages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('fail validation and persist REJECTED transfer to database', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Validator.validateByName.returns({validationPassed: false, reasons: []})
      TransferQueries.getById.returns(P.resolve(null))
      TransferHandler.prepare.returns(P.resolve(true))
      const result = await transferHandler.prepare(null, messages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('fail validation and duplicate entry should be updated to REJECTED and persisted to database', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Validator.validateByName.returns({validationPassed: false, reasons: []})
      TransferQueries.getById.returns(P.resolve({}))
      TransferHandler.reject.returns(P.resolve(true))
      const result = await transferHandler.prepare(null, messages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('throw an error when an error is by prepare', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Validator.validateByName.returns({validationPassed: true, reasons: []})
        TransferQueries.getById.returns(P.resolve(null))
        TransferHandler.prepare.throws(new Error)
        await transferHandler.prepare(null, messages)
        test.fail('No Error Thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })

    prepareTest.test('throw an error when an error is thrown from Kafka', async (test) => {
      try {
        await transferHandler.prepare(error, null)
        test.fail('No Error Thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })

    prepareTest.end()
  })

  transferHandlerTest.test('createPrepareHandler should', createPrepareHandlerTest => {
    createPrepareHandlerTest.test('register a consumer on Kafka', async (test) => {

    })
  })

  transferHandlerTest.end()
})
