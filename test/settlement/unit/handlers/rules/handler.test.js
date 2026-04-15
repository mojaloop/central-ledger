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

 * ModusBox
 - Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/
'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Util = require('@mojaloop/central-services-shared').Util
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const { logger } = require('../../../../../src/settlement/shared/logger')
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const Db = require('../../../../../src/settlement/lib/db')
const RulesService = require('../../../../../src/settlement/domain/rules/index')
const ScriptsLoader = require('../../../../../src/settlement/lib/scriptsLoader')
const RulesHandler = require('../../../../../src/settlement/handlers/rules/handler')
const Config = require('../../../../../src/settlement/lib/config')
const Proxyquire = require('proxyquire')
const idGenerator = require('@mojaloop/central-services-shared').Util.id

const generateULID = idGenerator({ type: 'ulid' })
const payload = {
  settlementWindowId: '3',
  reason: 'test'
}
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
  id: generateULID(),
  from: transfer.payerFsp,
  to: transfer.payeeFsp,
  type: 'application/json',
  content: {
    headers: { 'fspiop-destination': transfer.payerFsp },
    uriParams: { id: transfer.transferId },
    payload
  },
  metadata: {
    event: {
      id: generateULID(),
      type: 'notification',
      action: 'commit',
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

Test('RulesHandler', async (rulesHandlerTest) => {
  let sandbox
  let knexStub
  let trxStub
  rulesHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(KafkaConsumer.prototype, 'constructor').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'connect').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'consume').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').returns(Promise.resolve())
    sandbox.stub(Consumer, 'getConsumer').returns({
      commitMessageSync: async function () {
        return true
      }
    })
    sandbox.stub(Consumer, 'isConsumerAutoCommitEnabled').returns(false)
    sandbox.stub(Kafka)
    sandbox.stub(logger)
    sandbox.stub(Util.StreamingProtocol)
    Kafka.produceGeneralMessage.returns(Promise.resolve())
    knexStub = sandbox.stub()
    sandbox.stub(Db, 'getKnex').returns(knexStub)
    trxStub = sandbox.stub().returns({
      rollback: sandbox.stub()
    })
    knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
    // knexStub.transaction.rollback = sandbox.stub() //.callsArgWith(0, trxStub)
    test.end()
  })

  rulesHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  rulesHandlerTest.test('registerAllHandlers should', registerAllHandlersTest => {
    registerAllHandlersTest.test('register all consumers on Kafka', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      Kafka.getKafkaConfig.returns(config)
      sandbox.stub(ScriptsLoader, 'loadScripts').returns({})
      const result = await RulesHandler.registerAllHandlers()
      test.equal(result, true)
      test.ok(ScriptsLoader.loadScripts.withArgs('./scripts/transferSettlementTemp').calledOnce, 'ScriptsLoader loadScripts called once')
      test.end()
    })

    rulesHandlerTest.test('throw error registerAllHandlers', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformAccountToTopicName.returns(topicName)
        Kafka.proceed.returns(true)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())

        await RulesHandler.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    rulesHandlerTest.test('registerAllHandlers throws error when SCRIPTS_FOLDER config is missing', async (test) => {
      try {
        Config.HANDLERS.SETTINGS.RULES.SCRIPTS_FOLDER = null
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformAccountToTopicName.returns(topicName)
        Kafka.proceed.returns(true)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        sandbox.stub(ScriptsLoader, 'loadScripts').returns({})
        const RulesHandlerProxy = Proxyquire('../../../../../src/settlement/handlers/rules/handler', {
          '../../lib/config': Config
        })
        await RulesHandlerProxy.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerAllHandlersTest.end()
  })

  rulesHandlerTest.test('processRules should', processRulesTest => {
    processRulesTest.test('process when messages is in array', async (test) => {
      const localMessages = Util.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      sandbox.stub(RulesService, 'insertLedgerEntries')
      sandbox.stub(ScriptsLoader, 'executeScripts').returns({})
      const result = await RulesHandler.processRules(null, localMessages)
      test.equal(result, true)
      test.ok(RulesService.insertLedgerEntries.notCalled, 'insertLedgerEntries called once')
      test.end()
    })

    processRulesTest.test('process when there is a single message', async (test) => {
      const localMessages = Util.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      sandbox.stub(RulesService, 'insertLedgerEntries')
      sandbox.stub(ScriptsLoader, 'executeScripts').returns({})
      const result = await RulesHandler.processRules(null, localMessages[0])
      test.equal(result, true)
      test.ok(RulesService.insertLedgerEntries.notCalled, 'insertLedgerEntries called once')
      test.end()
    })

    processRulesTest.test('process when there is a single message with ledger entries', async (test) => {
      const localMessages = Util.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      sandbox.stub(ScriptsLoader, 'executeScripts').returns({
        ledgerEntries: [{
          transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
          ledgerAccountTypeId: 'INTERCHANGE_FEE',
          ledgerEntryTypeId: 'INTERCHANGE_FEE',
          amount: 0.02,
          currency: 'USD',
          payerFspId: 'dfsp1',
          payeeFspId: 'dfsp2'
        }]
      })
      sandbox.stub(RulesService, 'insertLedgerEntries')
      const result = await RulesHandler.processRules(null, localMessages[0])
      test.equal(result, true)
      console.log(RulesService.insertLedgerEntries.callCount)
      test.ok(RulesService.insertLedgerEntries.calledOnce, 'insertLedgerEntries called once')
      test.end()
    })

    processRulesTest.test('rollback a transaction on error', async (test) => {
      const localMessages = Util.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      sandbox.stub(ScriptsLoader, 'executeScripts').returns({
        ledgerEntries: [{
          transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
          ledgerAccountTypeId: 'INTERCHANGE_FEE',
          ledgerEntryTypeId: 'INTERCHANGE_FEE',
          amount: 0.02,
          currency: 'USD',
          payerFspId: 'dfsp1',
          payeeFspId: 'dfsp2'
        }]
      })
      sandbox.stub(RulesService, 'insertLedgerEntries').throws(new Error())
      const result = await RulesHandler.processRules(null, localMessages[0])
      test.equal(result, true)
      test.ok(RulesService.insertLedgerEntries.calledOnce, 'insertLedgerEntries called once')
      test.end()
    })

    processRulesTest.test('create a FSPIOP error when an error condition is passed in', async (test) => {
      const localMessages = Util.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      try {
        await RulesHandler.processRules(true, localMessages[0])
        test.fail('should throw error')
        test.end()
      } catch (err) {
        test.ok('FSPIOP Error is thrown.')
        test.end()
      }
    })

    processRulesTest.test('create a FSPIOP error when the payload is null', async (test) => {
      const localMessages = Util.clone(messages)
      localMessages[0].value.content.payload = null
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      try {
        await RulesHandler.processRules(null, localMessages[0])
        test.pass('Update terminated due to missing payload')
        test.end()
      } catch (err) {
        test.ok('FSPIOP Error is thrown.')
        test.end()
      }
    })

    processRulesTest.test('create a FSPIOP error when the event action is unknown', async (test) => {
      const localMessages = Util.clone(messages)
      localMessages[0].value.metadata.event.action = 'unknown'
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      try {
        await RulesHandler.processRules(null, localMessages[0])
        test.pass('Update terminated due to unknown event action')
        test.end()
      } catch (err) {
        test.ok('FSPIOP Error is thrown.')
        test.end()
      }
    })
    processRulesTest.end()
  })

  rulesHandlerTest.end()
})
