'use strict'

const Test = require('tape')
// const Sinon = require('sinon')
// const P = require('bluebird')
const Logger = require('@mojaloop/central-services-shared').Logger
const Uuid = require('uuid4')
// const wait = require('wait-for-stuff')

const Config = require('../../../src/lib/config')
const Handlers = require('../../../src/handlers/handlers')
const Db = require('@mojaloop/central-services-database').Db
const Producer = require('../../../src/handlers/lib/kafka/producer')
const Utility = require('../../../src/handlers/lib/utility')
const Participant = require('../../../src/domain/participant')
// const TransferHandler = require('../../../src/handlers/transfers/handler')
// const PositionHandler = require('../../../src/handlers/positions/handler')
// const NotificationHandler = require('../../../src/handlers/notification/handler')
// const TransferProjection = require('../../../src/domain/transfer/projection')
const TransferState = require('../../../src/domain/transfer/state')
const TransferReadModel = require('../../../src/domain/transfer/models/transfer-read-model')
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
  condition: 'ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0',
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
// const topicConf = {
//   topicName: Utility.transformAccountToTopicName(transfer.payerFsp, 'position', 'prepare'),
//   key: 'producerTest',
//   partition: 0,
//   opaqueKey: 0
// }

// const topicConf = {
//   topicName: Utility.transformGeneralTopicName('transfer', 'transfer'),
//   key: 'producerTest',
//   partition: 0,
//   opaqueKey: 0
// }

// const topicConf = {
//   topicName: Utility.transformGeneralTopicName('transfer', 'transfer'),
//   key: 'producerTest',
//   partition: 0,
//   opaqueKey: 0
// }

exports.testProducer = async () => {

}

// exports.testProducer = async () => {
//   const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, 'POSITION', 'PREPARE')
//   config.logger = Logger
//   await Producer.produceMessage(messageProtocol, topicConf, config)
//   return true
// }

Test('Handlers test', async handlersTest => {
  // handlersTest.beforeEach(async (test) => {
  //   await Db.connect(Config.DATABASE_URI)
  //   await Handlers.registerAllHandlers()
  //   setTimeout(() => {
  //     test.end()
  //   }, 10000)
  // })

  handlersTest.test('registerAllHandlers should', async registerAllHandlers => {
    // registerAllHandlers.beforeEach(async (test) => {
    //   await Db.connect(Config.DATABASE_URI)
    //   await Handlers.registerAllHandlers()
    //   setTimeout(() => {
    //     test.end()
    //   }, 10000)
    // })

    await registerAllHandlers.test('setup', async (test) => {
      await Db.connect(Config.DATABASE_URI)
      for (let payload of participants) {
        const participant = await Participant.getByName(payload.name)
        if (!participant) {
          await Participant.create(payload)
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
          var transfer = await TransferReadModel.getById(messageProtocol.id)
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
          var transfer = await TransferReadModel.getById(messageProtocol.id)
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
  await Producer.disconnect()
  // add loop code to disconnect consumers
  process.exit(0)
})
