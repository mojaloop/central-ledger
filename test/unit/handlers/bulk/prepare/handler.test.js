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

 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/
'use strict'

const { randomUUID } = require('crypto')
const Sinon = require('sinon')
const Proxyquire = require('proxyquire')
const Test = require('tapes')(require('tape'))
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const MainUtil = require('@mojaloop/central-services-shared').Util
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Validator = require('#src/handlers/bulk/shared/validator')
const BulkTransferService = require('#src/domain/bulkTransfer/index')
const BulkTransferModel = require('#src/models/bulkTransfer/bulkTransfer')
const BulkTransferModels = require('@mojaloop/object-store-lib').Models.BulkTransfer
const ilp = require('#src/models/transfer/ilpPacket')
const ProxyCache = require('#src/lib/proxyCache')
const { overrideForTesting, resetOverride } = require('../../../../../src/lib/config')

// Sample Bulk Transfer Message received by the Bulk API Adapter
const fspiopBulkTransferMsg = {
  bulkTransferId: 'fake-bulk-transfer-id',
  bulkQuoteId: 'fake-bulk-quote-id',
  payerFsp: 'dfsp1',
  payeeFsp: 'dfsp2',
  expiration: '2016-05-24T08:38:08.699-04:00',
  individualTransfers: [
    {
      transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
      transferAmount: {
        currency: 'USD',
        amount: '433.88'
      },
      ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
      condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI'
    }
  ],
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

// Sample Bulk Transfer Message published by the Bulk API Adapter to Kafka for consumption by the Bulk Transfer Prepare Handler
const bulkTransferPrepareMsg = {
  bulkTransferId: fspiopBulkTransferMsg.bulkTransferId,
  bulkQuoteId: fspiopBulkTransferMsg.bulkQuoteId,
  payerFsp: fspiopBulkTransferMsg.payerFsp,
  payeeFsp: fspiopBulkTransferMsg.payeeFsp,
  expiration: fspiopBulkTransferMsg.expiration,
  hash: 'bAEbmtteS+Su266MkU3vZvzS/Jllojm7iGo1K0Vfbt0'
}

// Sample Kafka protocol message containing the Bulk Transfer Message published by the Bulk API Adapter to Kafka for consumption by the Bulk Transfer Prepare Handler
const messageProtocol = {
  id: randomUUID(),
  from: fspiopBulkTransferMsg.payerFsp,
  to: fspiopBulkTransferMsg.payeeFsp,
  type: 'application/json',
  content: {
    headers: {
      'content-type': 'application/vnd.interoperability.bulkTransfers+json;version=1.1',
      'fspiop-source': fspiopBulkTransferMsg.payeeFsp,
      'fspiop-destination': 'source',
      date: new Date().toISOString()
    },
    payload: bulkTransferPrepareMsg
  },
  metadata: {
    event: {
      id: randomUUID(),
      type: Enum.Events.Event.Type.BULK,
      action: Enum.Events.Event.Action.BULK_PREPARE,
      createdAt: new Date().toISOString(),
      state: {
        status: 'success',
        code: 0
      }
    },
    'protocol.createdAt': new Date().getTime()
  },
  pp: ''
}

// Sample Kafka topic name
const topicName = 'topic-test'

// Sample Kafka Consumer message list
const messages = [
  {
    topic: topicName,
    value: messageProtocol
  }
]

// Sample Kafka config
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

// Sample Command handler for the Kafka Consumer
const command = () => { }

Test('Bulk Transfer PREPARE handler', handlerTest => {
  let sandbox
  let SpanStub
  let allBulkTransferHandlers

  handlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    overrideForTesting({ MONGODB_DISABLED: false })
    sandbox.stub(ProxyCache, 'getCache').returns({
      connect: sandbox.stub(),
      disconnect: sandbox.stub()
    })
    SpanStub = {
      audit: sandbox.stub().callsFake(),
      error: sandbox.stub().callsFake(),
      finish: sandbox.stub().callsFake(),
      debug: sandbox.stub().callsFake(),
      info: sandbox.stub().callsFake(),
      getChild: sandbox.stub().returns(SpanStub),
      setTags: sandbox.stub().callsFake()
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

    allBulkTransferHandlers = Proxyquire('#src/handlers/bulk/prepare/handler', {
      '@mojaloop/event-sdk': EventSdkStub
      // '@mojaloop/object-store-lib': TODO
    })

    sandbox.stub(KafkaConsumer.prototype, 'constructor').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'connect').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'consume').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').returns(Promise.resolve())
    sandbox.spy(Comparators)
    sandbox.stub(Validator)
    sandbox.stub(BulkTransferService)
    sandbox.stub(BulkTransferModel)
    sandbox.stub(BulkTransferModels)
    sandbox.stub(Consumer, 'getConsumer').returns({
      commitMessageSync: async function () {
        return true
      }
    })
    sandbox.stub(Consumer, 'isConsumerAutoCommitEnabled').returns(false)
    sandbox.stub(ilp)
    sandbox.stub(Kafka)
    sandbox.stub(MainUtil.StreamingProtocol)
    Kafka.produceGeneralMessage.returns(Promise.resolve())
    test.end()
  })

  handlerTest.afterEach(test => {
    sandbox.restore()
    resetOverride()
    test.end()
  })

  handlerTest.test('registerBulkPrepareHandler should', registerHandlerTest => {
    registerHandlerTest.test('returns true when registering the Bulk Prepare Transfer handler', async (test) => {
      // Arrange
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Act
      const result = await allBulkTransferHandlers.registerBulkPrepareHandler()

      // Assert
      test.equal(result, true)
      test.end()
    })

    registerHandlerTest.test('return an error when registering Bulk Prepare Transfer handler', async (test) => {
      try {
        // Arrange
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())

        // Act
        await allBulkTransferHandlers.registerBulkPrepareHandler()

        // Assert
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        // Assert
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlerTest.end()
  })

  handlerTest.test('registerAllHandlers should', registerHandlerTest => {
    registerHandlerTest.test('returns true when registering the Bulk Prepare Transfer handler', async (test) => {
      // Arrange
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Act
      const result = await allBulkTransferHandlers.registerAllHandlers()

      // Assert
      test.equal(result, true)
      test.end()
    })

    registerHandlerTest.test('return an error when registering Bulk Prepare Transfer handler', async (test) => {
      try {
        // Arrange
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())

        // Act
        await allBulkTransferHandlers.registerAllHandlers()

        // Assert
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        // Assert
        console.log(e)
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlerTest.end()
  })

  handlerTest.test('Bulk Prepare Transfer handler should', bulkPrepareTransferTest => {
    bulkPrepareTransferTest.test('handle duplicate Bulk Transfer Prepare when bulkTransfer record is found with matching hash', async (test) => {
      try {
        // Arrange
        const localMessages = MainUtil.clone(messages)

        await Consumer.createHandler(topicName, config, command)
        Kafka.transformAccountToTopicName.returns(topicName)
        Kafka.proceed.returns(true)

        BulkTransferService.getBulkTransferDuplicateCheck.onCall(0).resolves({ id: bulkTransferPrepareMsg.bulkTransferId, hash: bulkTransferPrepareMsg.hash })
        BulkTransferService.saveBulkTransferDuplicateCheck.onCall(0).resolves(true)

        const bulkResponse = {
          bulkTransferId: fspiopBulkTransferMsg.bulkTransferId,
          bulkTransferState: Enum.Transfers.BulkTransferState.COMPLETED,
          completedTimestamp: new Date().toISOString(),
          individualTransferResults: fspiopBulkTransferMsg.individualTransfers,
          extensionList: fspiopBulkTransferMsg.extensionList
        }
        const getBulkTransferByIdResponse = {
          bulkTransferId: fspiopBulkTransferMsg.bulkTransferId,
          bulkQuoteId: fspiopBulkTransferMsg.bulkQuoteId,
          payerFsp: fspiopBulkTransferMsg.payerFsp,
          payeeFsp: fspiopBulkTransferMsg.payeeFsp,
          expiration: fspiopBulkTransferMsg.expiration,
          completedDate: bulkResponse.completedTimestamp,
          payerBulkTransfer: { destination: fspiopBulkTransferMsg.payerFsp, ...bulkResponse },
          payeeBulkTransfer: { destination: fspiopBulkTransferMsg.payeeFsp, ...bulkResponse }
        }

        BulkTransferService.getBulkTransferById.onCall(0).resolves(getBulkTransferByIdResponse)

        // Act
        const result = await allBulkTransferHandlers.bulkPrepare(null, localMessages)

        // Assert
        test.equal(result, true)
        test.equal(Kafka.proceed.lastCall.args[1]?.message?.value?.content?.payload?.bulkTransferState, Enum.Transfers.BulkTransferState.COMPLETED)
        test.equal(Kafka.proceed.lastCall.args[1]?.message?.value?.content.uriParams.id, fspiopBulkTransferMsg.bulkTransferId)
        test.equal(Kafka.proceed.lastCall.args[2]?.eventDetail?.action, Enum.Events.Event.Action.BULK_PREPARE_DUPLICATE)
        test.equal(Kafka.proceed.lastCall.args[2]?.eventDetail?.functionality, Enum.Events.Event.Type.NOTIFICATION)
        test.equal(Kafka.proceed.lastCall.args[2]?.fromSwitch, true)
        test.end()
      } catch (err) {
        // Assert
        console.log(err)
        test.fail('Error should NOT have been cought here!')
        test.end()
      }
    })

    bulkPrepareTransferTest.test('handle duplicate Bulk Transfer Prepare when bulkTransfer record is found with NON-matching hash', async (test) => {
      try {
        // Arrange
        const localMessages = MainUtil.clone(messages)

        await Consumer.createHandler(topicName, config, command)
        Kafka.transformAccountToTopicName.returns(topicName)
        Kafka.proceed.returns(true)

        BulkTransferService.getBulkTransferDuplicateCheck.onCall(0).resolves({ id: bulkTransferPrepareMsg.bulkTransferId, hash: 'DO-NOT-MATCH-HASH' })
        BulkTransferService.saveBulkTransferDuplicateCheck.onCall(0).returns(Promise.resolve(true))

        const bulkResponse = {
          bulkTransferId: fspiopBulkTransferMsg.bulkTransferId,
          bulkTransferState: Enum.Transfers.BulkTransferState.COMPLETED,
          completedTimestamp: new Date().toISOString(),
          individualTransferResults: fspiopBulkTransferMsg.individualTransfers,
          extensionList: fspiopBulkTransferMsg.extensionList
        }
        const getBulkTransferByIdResponse = {
          bulkTransferId: fspiopBulkTransferMsg.bulkTransferId,
          bulkQuoteId: fspiopBulkTransferMsg.bulkQuoteId,
          payerFsp: fspiopBulkTransferMsg.payerFsp,
          payeeFsp: fspiopBulkTransferMsg.payeeFsp,
          expiration: fspiopBulkTransferMsg.expiration,
          completedDate: bulkResponse.completedTimestamp,
          payerBulkTransfer: { destination: fspiopBulkTransferMsg.payerFsp, ...bulkResponse },
          payeeBulkTransfer: { destination: fspiopBulkTransferMsg.payeeFsp, ...bulkResponse }
        }

        BulkTransferService.getBulkTransferById.onCall(0).resolves(getBulkTransferByIdResponse)

        // Act
        const result = await allBulkTransferHandlers.bulkPrepare(null, localMessages)

        // Assert
        test.equal(result, false)
        test.fail(`${ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST} should have been thrown!`)
        test.end()
      } catch (err) {
        // Assert
        console.log(err)
        test.equal(Kafka.proceed.lastCall.args[2].fspiopError.errorInformation.errorCode, ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST.code)
        test.equal(Kafka.proceed.lastCall.args[2].fspiopError.errorInformation.errorDescription, ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST.message)
        test.equal(Kafka.proceed.lastCall.args[2]?.fromSwitch, true)
        test.same(err.apiErrorCode, ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST)
        test.end()
      }
    })

    bulkPrepareTransferTest.test('handle new Bulk Transfer Prepare when bulkTransfer is NOT valid', async (test) => {
      try {
        // Arrange
        const localMessages = MainUtil.clone(messages)

        await Consumer.createHandler(topicName, config, command)
        Kafka.transformAccountToTopicName.returns(topicName)
        Kafka.proceed.returns(true)

        Validator.validateBulkTransfer.returns(
          {
            isValid: false,
            reasons: [
              ErrorHandler.Factory.createFSPIOPError(
                ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
                'A valid Bulk transfer message must be provided'
              )
            ]
          }
        )

        BulkTransferService.getBulkTransferDuplicateCheck.onCall(0).resolves(null)
        BulkTransferService.saveBulkTransferDuplicateCheck.onCall(0).resolves(true)

        const bulkResponse = {
          bulkTransferId: fspiopBulkTransferMsg.bulkTransferId,
          bulkTransferState: Enum.Transfers.BulkTransferState.COMPLETED,
          completedTimestamp: new Date().toISOString(),
          individualTransferResults: fspiopBulkTransferMsg.individualTransfers,
          extensionList: fspiopBulkTransferMsg.extensionList
        }
        const getBulkTransferByIdResponse = {
          bulkTransferId: fspiopBulkTransferMsg.bulkTransferId,
          bulkQuoteId: fspiopBulkTransferMsg.bulkQuoteId,
          payerFsp: fspiopBulkTransferMsg.payerFsp,
          payeeFsp: fspiopBulkTransferMsg.payeeFsp,
          expiration: fspiopBulkTransferMsg.expiration,
          completedDate: bulkResponse.completedTimestamp,
          payerBulkTransfer: { destination: fspiopBulkTransferMsg.payerFsp, ...bulkResponse },
          payeeBulkTransfer: { destination: fspiopBulkTransferMsg.payeeFsp, ...bulkResponse }
        }

        BulkTransferService.getBulkTransferById.onCall(0).returns(Promise.resolve(getBulkTransferByIdResponse))

        // Act
        const result = await allBulkTransferHandlers.bulkPrepare(null, localMessages)

        // Assert
        test.equal(result, false)
        test.fail(`${ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR} should have been thrown!`)
        test.end()
      } catch (err) {
        // Assert
        console.log(err)
        const duplicateCheckComparatorReturnValue = await Comparators.duplicateCheckComparator.lastCall.returnValue
        test.ok(duplicateCheckComparatorReturnValue)
        test.notOk(duplicateCheckComparatorReturnValue.hasDuplicateId)
        test.notOk(duplicateCheckComparatorReturnValue.hasDuplicateHash)
        test.equal(Comparators.duplicateCheckComparator.lastCall.args[0], bulkTransferPrepareMsg.bulkTransferId)
        test.equal(Comparators.duplicateCheckComparator.lastCall.args[1], bulkTransferPrepareMsg.hash)
        test.same(err.apiErrorCode, ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR)
        test.end()
      }
    })

    bulkPrepareTransferTest.end()
  })

  handlerTest.end()
})
