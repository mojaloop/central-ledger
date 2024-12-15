/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
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

* Gates Foundation
- Name Surname <name.surname@gatesfoundation.com>

* Georgi Georgiev <georgi.georgiev@modusbox.com>
* Rajiv Mothilal <rajiv.mothilal@modusbox.com>
* Miguel de Barros <miguel.debarros@modusbox.com>
* Deon Botha <deon.botha@modusbox.com>
* Shashikant Hirugade <shashikant.hirugade@modusbox.com>

--------------
******/
'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Validator = require('../../../../src/handlers/transfers/validator')
const TransferService = require('../../../../src/domain/transfer')
const FxTransferService = require('../../../../src/domain/fx')
const Cyril = require('../../../../src/domain/fx/cyril')
const TransferObjectTransform = require('../../../../src/domain/transfer/transform')
const MainUtil = require('@mojaloop/central-services-shared').Util
const ilp = require('../../../../src/models/transfer/ilpPacket')
const { randomUUID } = require('crypto')
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const EventSdk = require('@mojaloop/event-sdk')
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const Proxyquire = require('proxyquire')
const Participant = require('../../../../src/domain/participant')
const Config = require('../../../../src/lib/config')
const fxTransferModel = require('../../../../src/models/fxTransfer')
const fxDuplicateCheck = require('../../../../src/models/fxTransfer/duplicateCheck')
const fxTransferStateChange = require('../../../../src/models/fxTransfer/stateChange')
const ProxyCache = require('../../../../src/lib/proxyCache')
const TransferModel = require('../../../../src/models/transfer/transfer')

const { Action } = Enum.Events.Event

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

const fxTransfer = {
  commitRequestId: '88622a75-5bde-4da4-a6cc-f4cd23b268c4',
  determiningTransferId: 'c05c3f31-33b5-4e33-8bfd-7c3a2685fb6c',
  condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)), // tomorrow
  initiatingFsp: 'fx_dfsp1',
  counterPartyFsp: 'fx_dfsp2',
  sourceAmount: {
    currency: 'USD',
    amount: '433.88'
  },
  targetAmount: {
    currency: 'EUR',
    amount: '200.00'
  }
}
const transferReturn = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  amount: {
    currency: 'USD',
    amount: '433.88'
  },
  transferState: 'COMMITTED',
  transferStateEnumeration: 'COMMITTED',
  completedTimestamp: '2016-05-15T18:44:38.000Z',
  ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
  condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
  expiration: '2016-05-24T08:38:08.699-04:00',
  fulfilment: 'uz0FAeutW6o8Mz7OmJh8ALX6mmsZCcIDOqtE01eo4uI',
  extensionList: [{
    key: 'key1',
    value: 'value1'
  }]
}

const fulfil = {
  fulfilment: 'oAKAAA',
  completedTimestamp: '2018-10-24T08:38:08.699-04:00',
  transferState: 'COMMITTED',
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
  id: randomUUID(),
  from: transfer.payerFsp,
  to: transfer.payeeFsp,
  type: 'application/json',
  content: {
    headers: { 'fspiop-destination': transfer.payerFsp, 'content-type': 'application/vnd.interoperability.transfers+json;version=1.1' },
    uriParams: { id: transfer.transferId },
    payload: transfer
  },
  metadata: {
    event: {
      id: randomUUID(),
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

const fxMessageProtocol = {
  id: randomUUID(),
  from: fxTransfer.initiatingFsp,
  to: fxTransfer.counterPartyFsp,
  type: 'application/json',
  content: {
    headers: {
      'fspiop-destination': fxTransfer.initiatingFsp,
      'content-type': 'application/vnd.interoperability.transfers+json;version=1.1'
    },
    uriParams: { id: fxTransfer.commitRequestId },
    payload: fxTransfer
  },
  metadata: {
    event: {
      id: randomUUID(),
      type: 'fx-prepare',
      action: Action.FX_PREPARE,
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    }
  },
  pp: ''
}

const messageForwardedProtocol = {
  id: randomUUID(),
  from: '',
  to: '',
  type: 'application/json',
  content: {
    uriParams: { id: transfer.transferId },
    payload: {
      proxyId: '',
      transferId: transfer.transferId
    }
  },
  metadata: {
    event: {
      id: randomUUID(),
      type: 'prepare',
      action: 'forwarded',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    }
  },
  pp: ''
}

const messageFxForwardedProtocol = {
  id: randomUUID(),
  from: '',
  to: '',
  type: 'application/json',
  content: {
    uriParams: { id: fxTransfer.commitRequestId },
    payload: {
      proxyId: '',
      commitRequestId: fxTransfer.commitRequestId
    }
  },
  metadata: {
    event: {
      id: randomUUID(),
      type: 'prepare',
      action: 'fx-forwarded',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    }
  },
  pp: ''
}

const messageProtocolBulkPrepare = MainUtil.clone(messageProtocol)
messageProtocolBulkPrepare.metadata.event.action = 'bulk-prepare'
const messageProtocolBulkCommit = MainUtil.clone(messageProtocol)
messageProtocolBulkCommit.metadata.event.action = 'bulk-commit'

const topicName = 'topic-test'

const messages = [
  {
    topic: topicName,
    value: messageProtocol
  },
  {
    topic: topicName,
    value: messageProtocolBulkPrepare
  }
]

const fxMessages = [
  {
    topic: topicName,
    value: fxMessageProtocol
  }
]

const forwardedMessages = [
  {
    topic: topicName,
    value: messageForwardedProtocol
  }
]

const fxForwardedMessages = [
  {
    topic: topicName,
    value: messageFxForwardedProtocol
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

const configAutocommit = {
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
    'enable.auto.commit': true
  }
}

const command = () => {
}

const error = () => {
  throw new Error()
}

let SpanStub
let allTransferHandlers
let prepare
let createRemittanceEntity

const cyrilStub = async (payload) => {
  if (payload.determiningTransferId) {
    return {
      participantName: payload.initiatingFsp,
      currencyId: payload.targetAmount.currency,
      amount: payload.targetAmount.amount
    }
  }
  if (payload.transferId === fxTransfer.determiningTransferId) {
    return {
      participantName: 'proxyAR',
      currencyId: fxTransfer.targetAmount.currency,
      amount: fxTransfer.targetAmount.amount
    }
  }
  return {
    participantName: payload.payerFsp,
    currencyId: payload.amount.currency,
    amount: payload.amount.amount
  }
}

Test('Transfer handler', transferHandlerTest => {
  let sandbox
  let getProxyCacheStub
  let getFSPProxyStub
  let checkSameCreditorDebtorProxyStub

  transferHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    getProxyCacheStub = sandbox.stub(ProxyCache, 'getCache')
    getProxyCacheStub.returns({
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

    createRemittanceEntity = Proxyquire('../../../../src/handlers/transfers/createRemittanceEntity', {
      '../../domain/fx/cyril': {
        getParticipantAndCurrencyForTransferMessage: cyrilStub,
        getParticipantAndCurrencyForFxTransferMessage: cyrilStub,
        getPositionParticipant: cyrilStub
      }
    })
    prepare = Proxyquire('../../../../src/handlers/transfers/prepare', {
      '@mojaloop/event-sdk': EventSdkStub,
      './createRemittanceEntity': createRemittanceEntity
    })
    allTransferHandlers = Proxyquire('../../../../src/handlers/transfers/handler', {
      '@mojaloop/event-sdk': EventSdkStub,
      './prepare': prepare
    })

    sandbox.stub(KafkaConsumer.prototype, 'constructor').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'connect').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'consume').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').returns(Promise.resolve())
    sandbox.stub(Comparators)
    sandbox.stub(Validator)
    sandbox.stub(TransferService)
    sandbox.stub(FxTransferService)
    sandbox.stub(fxTransferModel.fxTransfer)
    sandbox.stub(fxTransferModel.watchList)
    sandbox.stub(fxDuplicateCheck)
    sandbox.stub(fxTransferStateChange)
    sandbox.stub(Cyril)
    sandbox.stub(TransferModel)
    Cyril.processFulfilMessage.returns({
      isFx: false
    })
    sandbox.stub(Consumer, 'getConsumer').returns({
      commitMessageSync: async function () {
        return true
      }
    })
    sandbox.stub(Consumer, 'isConsumerAutoCommitEnabled').returns(false)
    sandbox.stub(ilp)
    sandbox.stub(Kafka)
    sandbox.stub(MainUtil.StreamingProtocol)
    sandbox.stub(TransferObjectTransform, 'toTransfer')
    sandbox.stub(TransferObjectTransform, 'toFulfil')
    sandbox.stub(Participant, 'getAccountByNameAndCurrency').callsFake((...args) => {
      // Avoid using a participantCurrencyId of 0 as this is used to represent a
      // special proxy case where no action is to take place in the position handler
      if (args[0] === transfer.payerFsp) {
        return {
          participantCurrencyId: 1
        }
      }
      if (args[0] === fxTransfer.initiatingFsp) {
        return {
          participantCurrencyId: 2
        }
      }
      if (args[0] === transfer.payeeFsp || args[0] === fxTransfer.counterPartyFsp) {
        return {
          participantCurrencyId: 3
        }
      }
      if (args[0] === fxTransfer.counterPartyFsp) {
        return {
          participantCurrencyId: 4
        }
      }
      if (args[0] === 'ProxyAR') {
        return {
          participantCurrencyId: 5
        }
      }
      if (args[0] === 'ProxyRB') {
        return {
          participantCurrencyId: 6
        }
      }
    })
    Kafka.produceGeneralMessage.returns(Promise.resolve())
    Config.PROXY_CACHE_CONFIG.enabled = true
    getFSPProxyStub = sandbox.stub(ProxyCache, 'getFSPProxy')
    checkSameCreditorDebtorProxyStub = sandbox.stub(ProxyCache, 'checkSameCreditorDebtorProxy')
    getFSPProxyStub.withArgs(transfer.payerFsp).returns({
      inScheme: true,
      proxyId: null
    })
    getFSPProxyStub.withArgs(transfer.payeeFsp).returns({
      inScheme: true,
      proxyId: null
    })
    getFSPProxyStub.withArgs(fxTransfer.initiatingFsp).returns({
      inScheme: true,
      proxyId: null
    })
    getFSPProxyStub.withArgs(fxTransfer.counterPartyFsp).returns({
      inScheme: true,
      proxyId: null
    })
    checkSameCreditorDebtorProxyStub.resolves(false)
    test.end()
  })

  transferHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  transferHandlerTest.test('prepare should', prepareTest => {
    prepareTest.test('persist transfer to database when messages is an array', async (test) => {
      const localMessages = MainUtil.clone(messages)
      // here copy
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      fxTransferModel.watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
      test.equal(kafkaCallOne.args[2].messageKey, '1')
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('fail when messages array is empty', async (test) => {
      const localMessages = []
      // here copy
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      fxTransferModel.watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      try {
        await allTransferHandlers.prepare(null, localMessages)
        test.fail('Error not thrown')
        test.end()
      } catch (err) {
        test.ok(err instanceof Error)
        test.end()
      }
    })

    prepareTest.test('use topic name override if specified in config', async (test) => {
      Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.PREPARE = 'topic-test-override'
      const localMessages = MainUtil.clone(messages)
      // here copy
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      fxTransferModel.watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
      test.equal(kafkaCallOne.args[2].messageKey, '1')
      test.equal(kafkaCallOne.args[2].topicNameOverride, 'topic-test-override')
      test.equal(result, true)
      delete Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.PREPARE
      test.end()
    })

    prepareTest.test('persist transfer to database when messages is an array - consumer throws error', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.getConsumer.throws(new Error())
      Kafka.transformAccountToTopicName.returns(topicName)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      fxTransferModel.watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
      test.equal(kafkaCallOne.args[2].messageKey, '1')
      test.equal(result, true)
      test.end()
    })

    // Not sure why all these tests have conditions on transferState.
    // `prepare` does not currently have any code that checks transferState.
    prepareTest.test('send callback when duplicate found but without transferState', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.getByIdLight.returns(Promise.resolve(null))
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve(null))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found but without transferState - autocommit is enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.getByIdLight.returns(Promise.resolve(null))
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve(null))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found but without transferState - kafka autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.getByIdLight.returns(Promise.resolve(null))
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve(null))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found and transferState is COMMITTED', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getByIdLight.withArgs(transfer.transferId).returns(Promise.resolve(transferReturn))
      TransferObjectTransform.toTransfer.withArgs(transferReturn).returns(transfer)

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found and transferState is ABORTED_REJECTED', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve({ enumeration: 'ABORTED' }))
      TransferService.getById.withArgs(transfer.transferId).returns(Promise.resolve(transferReturn))

      TransferObjectTransform.toFulfil.withArgs(transferReturn).returns(fulfil)

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('do nothing when duplicate found and transferState is RECEIVED', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve({ enumeration: 'RECEIVED' }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('do nothing when duplicate found and transferState is RECEIVED', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve({ enumeration: 'unknown' }))
      localMessages[0].value.metadata.event.action = 'unknown'

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('do nothing when duplicate found and transferState is RESERVED', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve({ enumeration: 'RESERVED' }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate transfer id found but hash doesnt match', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate transfer id found but hash doesnt match - kafka autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when single message sent', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when BULK_PREPARE single message sent', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages[1])
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when single message sent - autocommit is enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when single message sent - kafka autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send notification when validation successful but duplicate error thrown by prepare', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.throws(new Error())
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send notification when validation successful but duplicate error thrown by prepare - kafka autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.throws(new Error())
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('fail validation and persist INVALID transfer to database and insert transferError', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      MainUtil.StreamingProtocol.createEventState.returns(messageProtocol.metadata.event.state)
      Validator.validatePrepare.returns({ validationPassed: false, reasons: [] })
      TransferService.getById.returns(Promise.resolve(null))
      TransferService.prepare.returns(Promise.resolve(true))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('fail validation and persist INVALID transfer to database and insert transferError -kafka autocommit enabled', async (test) => {
      await Consumer.createHandler(topicName, configAutocommit, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      MainUtil.StreamingProtocol.createEventState.returns(messageProtocol.metadata.event.state)
      Validator.validatePrepare.returns({ validationPassed: false, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))

      const result = await allTransferHandlers.prepare(null, messages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send notification when validation failed and duplicate error thrown by prepare', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: false, reasons: [] })
      TransferService.prepare.throws(new Error())
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send notification when validation failed and duplicate error thrown by prepare - kafka autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: false, reasons: [] })
      TransferService.prepare.throws(new Error())
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('log an error when consumer not found', async (test) => {
      try {
        const localMessages = MainUtil.clone(messages)
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformAccountToTopicName.returns('invalid-topic')
        await allTransferHandlers.prepare(null, localMessages)
        const expectedState = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, '2001', 'Internal server error')
        const args = SpanStub.finish.getCall(0).args
        test.ok(args[0].length > 0)
        test.deepEqual(args[1], expectedState)
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    prepareTest.test('throw an error when an error is thrown from Kafka', async (test) => {
      try {
        await allTransferHandlers.prepare(error, null)
        test.fail('No Error Thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })

    prepareTest.test('produce error for unexpected state when receiving fowarded event message', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      TransferService.getById.returns(Promise.resolve({ transferState: Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT }))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, forwardedMessages[0])
      test.equal(Kafka.proceed.getCall(0).args[2].fspiopError.errorInformation.errorCode, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('produce error on transfer not found when receiving forwarded event message', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      TransferService.getById.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, forwardedMessages[0])
      test.equal(result, true)
      test.equal(Kafka.proceed.getCall(0).args[2].fspiopError.errorInformation.errorCode, ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND.code)
      test.end()
    })

    prepareTest.test('produce error for unexpected state when receiving fx-fowarded event message', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      FxTransferService.getByIdLight.returns(Promise.resolve({ fxTransferState: Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT }))

      const result = await allTransferHandlers.prepare(null, fxForwardedMessages[0])
      test.equal(Kafka.proceed.getCall(0).args[2].fspiopError.errorInformation.errorCode, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('produce error on transfer not found when receiving fx-forwarded event message', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      FxTransferService.getByIdLight.returns(Promise.resolve(null))

      const result = await allTransferHandlers.prepare(null, fxForwardedMessages[0])
      test.equal(result, true)
      test.equal(Kafka.proceed.getCall(0).args[2].fspiopError.errorInformation.errorCode, ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND.code)
      test.end()
    })

    prepareTest.end()
  })

  transferHandlerTest.test('prepare proxy scenarios should', prepareProxyTest => {
    prepareProxyTest.test(`
      handle scenario scheme A: POST /fxTransfer call I.e. Debtor: Payer DFSP → Creditor: Proxy AR
      Payer DFSP postion account must be updated (reserved)
      substitute creditor(counterpartyFsp) if not in scheme and found in proxy cache for /fxTransfers msg`, async (test) => {
      // In this the counter party is not in scheme and is found in the proxy cache
      getFSPProxyStub.withArgs(fxTransfer.counterPartyFsp).returns({
        inScheme: false,
        proxyId: 'ProxyAR'
      })

      // Stub underlying methods for determiningTransferCheckResult
      // so that proper currency validation lists are returned
      TransferModel.getById.resolves(null)

      const localMessages = MainUtil.clone(fxMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      fxTransferModel.fxTransfer.savePreparedRequest.returns(Promise.resolve(true))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      // Payer DFSP postion account must be updated (reserved)
      // The generated position message should be keyed with the initiatingFsp participant currency id
      // which is `payerFsp` in this case
      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)
      test.equal(kafkaCallOne.args[2].messageKey, '2')
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.FX_PREPARE)
      test.equal(result, true)

      // `to` `from` and `initiatingFsp` and `counterPartyFsp` is message should be the original values
      test.equal(kafkaCallOne.args[1].message.value.from, 'fx_dfsp1')
      test.equal(kafkaCallOne.args[1].message.value.to, 'fx_dfsp2')
      test.equal(kafkaCallOne.args[1].decodedPayload.initiatingFsp, 'fx_dfsp1')
      test.equal(kafkaCallOne.args[1].decodedPayload.counterPartyFsp, 'fx_dfsp2')
      test.end()
    })

    prepareProxyTest.test(`
      should handle Scheme A: POST /transfer call I.e. Debtor: Proxy AR → Creditor: Proxy AR
      Do nothing
      produce message with key=0 if both proxies for debtor and creditor are the same in /transfers msg`, async (test) => {
      // Stub payee with same proxy
      getFSPProxyStub.withArgs(transfer.payeeFsp).returns({
        inScheme: false,
        proxyId: 'proxyAR'
      })
      getFSPProxyStub.withArgs(fxTransfer.counterPartyFsp).returns({
        inScheme: false,
        proxyId: 'proxyAR'
      })
      checkSameCreditorDebtorProxyStub.resolves(true)
      // Stub watchlist to mimic that transfer is part of fxTransfer
      fxTransferModel.watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve([{
        fxTransferId: 1
      }]))

      const localMessages = MainUtil.clone(messages)
      localMessages[0].value.content.payload.transferId = 'c05c3f31-33b5-4e33-8bfd-7c3a2685fb6c'
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.prepare(null, localMessages[0])
      const kafkaCallOne = Kafka.proceed.getCall(0)

      // Do nothing is represented by the position message with key=0
      test.equal(kafkaCallOne.args[2].messageKey, '0')
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
      test.equal(result, true)

      // `to` `from` and `payerFsp` and `payeeFsp` is message should be the original values
      test.equal(kafkaCallOne.args[1].message.value.from, 'dfsp1')
      test.equal(kafkaCallOne.args[1].message.value.to, 'dfsp2')
      test.equal(kafkaCallOne.args[1].decodedPayload.payerFsp, 'dfsp1')
      test.equal(kafkaCallOne.args[1].decodedPayload.payeeFsp, 'dfsp2')
      test.end()
    })

    prepareProxyTest.test(`
      should handle Scheme R: POST /fxTransfer call I.e. Debtor: Proxy AR → Creditor: FXP
      Proxy AR position account in source currency must be updated (reserved)
      substitute debtor(initiatingFsp) if not in scheme and found in proxy cache for /fxTransfers msg`, async (test) => {
      // In this the initiatingFsp is not in scheme and is found in the proxy cache
      getFSPProxyStub.withArgs(fxTransfer.initiatingFsp).returns({
        inScheme: false,
        proxyId: 'ProxyAR'
      })

      // Stub underlying methods for determiningTransferCheckResult
      // so that proper currency validation lists are returned
      TransferModel.getById.resolves(null)

      const localMessages = MainUtil.clone(fxMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      fxTransferModel.fxTransfer.savePreparedRequest.returns(Promise.resolve(true))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      // The generated position message should be keyed with the proxy participant currency id
      // which is `initiatingFspProxy` in this case
      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)
      test.equal(kafkaCallOne.args[2].messageKey, '5')
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.FX_PREPARE)
      test.equal(result, true)

      // `to` `from` and `initiatingFsp` and `counterPartyFsp` is message should be the original values
      test.equal(kafkaCallOne.args[1].message.value.from, 'fx_dfsp1')
      test.equal(kafkaCallOne.args[1].message.value.to, 'fx_dfsp2')
      test.equal(kafkaCallOne.args[1].decodedPayload.initiatingFsp, 'fx_dfsp1')
      test.equal(kafkaCallOne.args[1].decodedPayload.counterPartyFsp, 'fx_dfsp2')

      test.end()
    })

    prepareProxyTest.test(`
      should handle Scheme R: POST /Transfer call I.e. Debtor: FXP → Creditor: Proxy RB
      FXP position account in targed currency must be updated (reserved)
      substitute creditor(payeeFsp) if not in scheme and found in proxy cache for /fxTransfers msg`, async (test) => {
      // Stub payee with same proxy
      getFSPProxyStub.withArgs(transfer.payeeFsp).returns({
        inScheme: false,
        proxyId: 'ProxyRB'
      })

      // Stub watchlist to mimic that transfer is part of fxTransfer
      fxTransferModel.watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve({ fxTransferId: 1 }))

      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.prepare(null, localMessages[0])
      const kafkaCallOne = Kafka.proceed.getCall(0)

      // The generated position message should be keyed with the fxp participant currency id
      // which is payerFsp in this case (naming here is confusing due reusing payload)
      test.equal(kafkaCallOne.args[2].messageKey, '1')
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
      test.equal(result, true)

      // `to` `from` and `payerFsp` and `payeeFsp` is message should be the original values
      test.equal(kafkaCallOne.args[1].message.value.from, 'dfsp1')
      test.equal(kafkaCallOne.args[1].message.value.to, 'dfsp2')
      test.equal(kafkaCallOne.args[1].decodedPayload.payerFsp, 'dfsp1')
      test.equal(kafkaCallOne.args[1].decodedPayload.payeeFsp, 'dfsp2')

      test.end()
    })

    prepareProxyTest.test(`
      should handle Scheme B: POST /transfer call I.e. Debtor: Proxy RB → Creditor: Payee DFSP
      Proxy RB postion account must be updated (reserved)
      substitute debtor(payerFsp) if not in scheme and found in proxy cache for /transfers msg`, async (test) => {
      // Stub payee with same proxy
      getFSPProxyStub.withArgs(transfer.payerFsp).returns({
        inScheme: false,
        proxyId: 'ProxyRB'
      })

      // Scheme B has no visibility that this is part of an fxTransfer
      fxTransferModel.watchList.getItemsInWatchListByDeterminingTransferId.returns(null)

      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.prepare(null, localMessages[0])
      const kafkaCallOne = Kafka.proceed.getCall(0)

      // The generated position message should be keyed with the payerFsp's proxy
      test.equal(kafkaCallOne.args[2].messageKey, '6')
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
      test.equal(result, true)

      // `to` `from` and `payerFsp` and `payeeFsp` is message should be the original values
      test.equal(kafkaCallOne.args[1].message.value.from, 'dfsp1')
      test.equal(kafkaCallOne.args[1].message.value.to, 'dfsp2')
      test.equal(kafkaCallOne.args[1].decodedPayload.payerFsp, 'dfsp1')
      test.equal(kafkaCallOne.args[1].decodedPayload.payeeFsp, 'dfsp2')
      test.end()
    })

    prepareProxyTest.test('throw error if debtor(payer) if not in scheme and not found in proxy cache in /transfers msg', async (test) => {
      getFSPProxyStub.withArgs(transfer.payerFsp).returns({
        inScheme: false,
        proxyId: null
      })
      getFSPProxyStub.withArgs(transfer.payeeFsp).returns({
        inScheme: false,
        proxyId: 'payeeProxy'
      })

      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      fxTransferModel.watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      try {
        test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.NOTIFICATION)
        test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail()
        test.end()
      }
    })

    prepareProxyTest.test('throw error if creditor(payee) if not in scheme and not found in proxy cache in /transfers msg', async (test) => {
      getFSPProxyStub.withArgs(transfer.payerFsp).returns({
        inScheme: false,
        proxyId: 'payerProxy'
      })
      getFSPProxyStub.withArgs(transfer.payeeFsp).returns({
        inScheme: false,
        proxyId: null
      })
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      fxTransferModel.watchList.getItemsInWatchListByDeterminingTransferId.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      try {
        test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.NOTIFICATION)
        test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail()
        test.end()
      }
    })

    prepareProxyTest.test('throw error if debtor(initiatingFsp) if not in scheme and not found in proxy cache in /fxTransfers msg', async (test) => {
      getFSPProxyStub.withArgs(fxTransfer.initiatingFsp).returns({
        inScheme: false,
        proxyId: null
      })
      getFSPProxyStub.withArgs(fxTransfer.counterPartyFsp).returns({
        inScheme: false,
        proxyId: 'counterPartyFspProxy'
      })
      const localMessages = MainUtil.clone(fxMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      fxTransferModel.fxTransfer.savePreparedRequest.returns(Promise.resolve(true))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      try {
        test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.NOTIFICATION)
        test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.FX_PREPARE)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail()
        test.end()
      }
    })

    prepareProxyTest.test('throw error if debtor(counterpartyFsp) if not in scheme and not found in proxy cache in /fxTransfers msg', async (test) => {
      getFSPProxyStub.withArgs(fxTransfer.initiatingFsp).returns({
        inScheme: false,
        proxyId: 'initiatingFspProxy'
      })
      getFSPProxyStub.withArgs(fxTransfer.counterPartyFsp).returns({
        inScheme: false,
        proxyId: null
      })
      const localMessages = MainUtil.clone(fxMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      fxTransferModel.fxTransfer.savePreparedRequest.returns(Promise.resolve(true))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      try {
        test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.NOTIFICATION)
        test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.FX_PREPARE)
        test.equal(result, true)
        test.end()
      } catch (e) {
        test.fail()
        test.end()
      }
    })

    prepareProxyTest.test('update reserved transfer on forwarded prepare message', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      TransferService.getById.returns(Promise.resolve({ transferState: Enum.Transfers.TransferInternalState.RESERVED }))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, forwardedMessages[0])
      test.ok(TransferService.forwardedPrepare.called)
      test.equal(result, true)
      test.end()
    })

    prepareProxyTest.test('update reserved fxTransfer on fx-forwarded prepare message', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      FxTransferService.getByIdLight.returns(Promise.resolve({ fxTransferState: Enum.Transfers.TransferInternalState.RESERVED }))
      const result = await allTransferHandlers.prepare(null, fxForwardedMessages[0])
      test.ok(FxTransferService.forwardedFxPrepare.called)
      test.equal(result, true)
      test.end()
    })

    prepareProxyTest.end()
  })

  transferHandlerTest.test('processDuplication', processDuplicationTest => {
    processDuplicationTest.test('return undefined hasDuplicateId is falsey', async (test) => {
      const result = await prepare.processDuplication({
        duplication: {
          hasDuplicateId: false
        }
      })
      test.equal(result, undefined)
      test.end()
    })

    processDuplicationTest.test('throw error if action is BULK_PREPARE', async (test) => {
      try {
        await prepare.processDuplication({
          duplication: {
            hasDuplicateId: true,
            hasDuplicateHash: true
          },
          location: { module: 'PrepareHandler', method: '', path: '' },
          action: Action.BULK_PREPARE
        })
        test.fail('Error not thrown')
      } catch (e) {
        test.pass('Error thrown')
      }
      test.end()
    })
    processDuplicationTest.end()
  })

  transferHandlerTest.test('payer initiated conversion fxPrepare should', fxPrepareTest => {
    fxPrepareTest.test('persist fxtransfer to database when messages is an array', async (test) => {
      const localMessages = MainUtil.clone(fxMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      fxTransferModel.fxTransfer.savePreparedRequest.returns(Promise.resolve(true))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.FX_PREPARE)
      test.equal(result, true)
      test.ok(Validator.validatePrepare.called)
      test.ok(fxTransferModel.fxTransfer.savePreparedRequest.called)
      test.ok(Comparators.duplicateCheckComparator.called)
      test.end()
    })

    fxPrepareTest.test('persist transfer to database when messages is an array - consumer throws error', async (test) => {
      const localMessages = MainUtil.clone(fxMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.getConsumer.throws(new Error())
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      fxTransferModel.fxTransfer.savePreparedRequest.returns(Promise.resolve(true))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.FX_PREPARE)
      test.equal(result, true)
      test.ok(Validator.validatePrepare.called)
      test.ok(fxTransferModel.fxTransfer.savePreparedRequest.called)
      test.ok(Comparators.duplicateCheckComparator.called)
      test.end()
    })

    fxPrepareTest.test('send callback when duplicate found', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)

      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      fxTransferModel.fxTransfer.savePreparedRequest.returns(Promise.resolve(true))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.prepare(null, localMessages)

      test.equal(result, true)
      test.end()
    })

    fxPrepareTest.test('persist transfer to database when single message sent', async (test) => {
      const localMessages = MainUtil.clone(fxMessages)
      await Consumer.createHandler(topicName, config, command)

      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      fxTransferModel.fxTransfer.savePreparedRequest.returns(Promise.resolve(true))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.prepare(null, localMessages[0])
      const kafkaCallOne = Kafka.proceed.getCall(0)

      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.FX_PREPARE)
      test.equal(result, true)
      test.ok(Validator.validatePrepare.called)
      test.ok(fxTransferModel.fxTransfer.savePreparedRequest.called)
      test.ok(Comparators.duplicateCheckComparator.called)
      test.end()
    })

    fxPrepareTest.test('send notification when validation failed and duplicate error thrown by prepare', async (test) => {
      const localMessages = MainUtil.clone(fxMessages)
      await Consumer.createHandler(topicName, config, command)

      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: false, reasons: [] })
      fxTransferModel.fxTransfer.savePreparedRequest.throws(new Error())
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.NOTIFICATION)
      // Is this not supposed to be FX_PREPARE?
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
      test.equal(result, true)
      test.end()
    })

    fxPrepareTest.test('send notification when validation failed and duplicate error thrown by prepare - kafka autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(fxMessages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)

      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: false, reasons: [] })
      fxTransferModel.fxTransfer.savePreparedRequest.throws(new Error())
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.NOTIFICATION)
      // Is this not supposed to be FX_PREPARE?
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
      test.equal(result, true)
      test.end()
    })

    fxPrepareTest.test('fail validation and persist INVALID transfer to database and insert transferError', async (test) => {
      const localMessages = MainUtil.clone(fxMessages)
      await Consumer.createHandler(topicName, config, command)

      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: false, reasons: [] })
      fxTransferModel.fxTransfer.savePreparedRequest.returns(Promise.resolve(true))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.NOTIFICATION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.FX_PREPARE)
      test.equal(result, true)
      test.ok(Validator.validatePrepare.called)
      test.ok(fxTransferModel.fxTransfer.savePreparedRequest.called)
      test.ok(Comparators.duplicateCheckComparator.called)
      test.end()
    })

    fxPrepareTest.test('fail validation and persist INVALID transfer to database and insert transferError - kafka autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(fxMessages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: false, reasons: [] })
      fxTransferModel.fxTransfer.savePreparedRequest.returns(Promise.resolve(true))
      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.NOTIFICATION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.FX_PREPARE)
      test.equal(result, true)
      test.ok(Validator.validatePrepare.called)
      test.ok(fxTransferModel.fxTransfer.savePreparedRequest.called)
      test.ok(Comparators.duplicateCheckComparator.called)
      test.end()
    })
    fxPrepareTest.end()
  })
  transferHandlerTest.end()
})
