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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tape')
const Logger = require('@mojaloop/central-services-shared').Logger
const Uuid = require('uuid4')

const Config = require('../../../src/lib/config')
const Handlers = require('../../../src/handlers/handlers')
const Db = require('@mojaloop/central-services-database').Db
const Producer = require('../../../src/handlers/lib/kafka/producer')
const Utility = require('../../../src/handlers/lib/utility')
const ParticipantService = require('../../../src/domain/participant')
const TransferState = require('../../../src/lib/enum').TransferState
const TransferFacade = require('../../../src/models/transfer/facade')
const Moment = require('moment')

const transfer = {
  transferId: Uuid(),
  payerFsp: 'dfsp1',
  payeeFsp: 'dfsp2',
  amount: {
    currency: 'USD',
    amount: '433.88'
  },
  ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
  condition: '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU',
  expiration: '2018-11-24T08:38:08.699-04:00',
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

const fulfil = {
  fulfilment: '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU',
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

const messageProtocolFulfil = Object.assign({}, messageProtocol, {
  content: {
    payload: fulfil
  },
  metadata: {
    event: {
      id: Uuid(),
      type: 'fulfil',
      action: 'commit'
    }
  }
})

const topicConf = {
  topicName: Utility.transformAccountToTopicName(transfer.payerFsp, 'transfer', 'prepare'),
  key: 'producerTest',
  partition: 0,
  opaqueKey: 0
}

const topicConfFulfil = {
  topicName: Utility.transformGeneralTopicName('transfer', 'fulfil'),
  key: 'producerTest',
  partition: 0,
  opaqueKey: 0
}

const participants = [
  {
    name: 'dfsp1',
    currency: 'USD'
  },
  {
    name: 'dfsp2',
    currency: 'USD'
  }
]

exports.testProducer = async () => {}

Test('Handlers test', async handlersTest => {
  handlersTest.test('registerAllHandlers should', async registerAllHandlers => {
    await registerAllHandlers.test('setup', async (test) => {
      await Db.connect(Config.DATABASE_URI)
      for (let payload of participants) {
        const participant = await ParticipantService.getByName(payload.name)
        if (!participant) {
          const participantId = await ParticipantService.create({name: payload.name})
          await ParticipantService.createParticipantCurrency(participantId, payload.currency)
        }
      }
      await Handlers.registerAllHandlers()
      setTimeout(() => {
        test.end()
      }, 20000)
    })

    await registerAllHandlers.test('register all kafka handlers', async (test) => {
      var startTime = Moment()
      var targetProcessingTimeInSeconds = 25
      var elapsedSeconds = 0
      let isTransferHandlersPrepareCalled = false
      let result = null

      const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, 'TRANSFER', 'PREPARE')
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(messageProtocol, topicConf, config)

      setTimeout(async () => {
        while (elapsedSeconds < targetProcessingTimeInSeconds) {
          elapsedSeconds = Moment().diff(startTime, 'seconds')
          // console.log(`elapsedSeconds=${elapsedSeconds}`)
          var transfer = await TransferFacade.getById(messageProtocol.id)
          if (transfer) {
            result = true
            isTransferHandlersPrepareCalled = true
          }
        }

        test.equal(producerResponse, true, 'Producer for prepare published message')
        test.equal(isTransferHandlersPrepareCalled, true, 'Prepare callback was executed')
        test.equal(result, true, `Prepare callback was executed returned ${result}`)
        test.end()
      }, 30000)
    })

    await registerAllHandlers.test('register all kafka handlers', async (test) => {
      var startTime = Moment()
      var targetProcessingTimeInSeconds = 25
      var elapsedSeconds = 0
      let isFulfilHandlerCalled = false
      let isTransferStateCommitted = false
      let isIlpFulfilmentUpdated = false
      let result = null

      const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, 'TRANSFER', 'FULFIL')
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(messageProtocolFulfil, topicConfFulfil, config)

      setTimeout(async () => {
        while (elapsedSeconds < targetProcessingTimeInSeconds) {
          elapsedSeconds = Moment().diff(startTime, 'seconds')
          // console.log(`elapsedSeconds=${elapsedSeconds}`)
          var transfer = await TransferFacade.getById(messageProtocol.id)
          if (transfer) {
            isFulfilHandlerCalled = true
            isTransferStateCommitted = transfer.transferState === TransferState.COMMITTED
            isIlpFulfilmentUpdated = transfer.fulfilment === fulfil.fulfilment
            result = true
          }
        }

        test.equal(producerResponse, true, 'Producer for fulfil published message')
        test.equal(isFulfilHandlerCalled, true, 'Fulfil callback was executed')
        test.equal(isTransferStateCommitted, true, 'Transfer state changed to COMMITTED')
        test.equal(isIlpFulfilmentUpdated, true, 'Fulfilment updated ilp table record')
        test.equal(result, true, `Fulfil callback was executed returned ${result}`)
        test.end()
      }, 30000)
    })

    registerAllHandlers.end()
  })

  handlersTest.end()
})

Test.onFinish(async () => {
  await Producer.disconnect(topicConf.topicName)
  // add loop code to disconnect consumers
  process.exit(0)
})
