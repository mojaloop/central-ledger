'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Logger = require('@mojaloop/central-services-shared').Logger
const Uuid = require('uuid4')
const wait = require('wait-for-stuff')

const Config = require('../../../src/lib/config')
const Handlers = require('../../../src/handlers/handlers')
const Db = require('@mojaloop/central-services-database').Db
const Producer = require('../../../src/handlers/lib/kafka/producer')
const Utility = require('../../../src/handlers/lib/utility')
const TransferHandler = require('../../../src/handlers/transfers/handler')
const PositionHandler = require('../../../src/handlers/positions/handler')
const NotificationHandler = require('../../../src/handlers/notification/handler')

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

const topicConf = {
  topicName: Utility.transformAccountToTopicName(transfer.payerFsp, 'transfer', 'prepare'),
  key: 'producerTest',
  partition: 0,
  opaqueKey: 0
}

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


Test('Handlers test', handlersTest => {

  handlersTest.beforeEach(async (test) => {
    await Db.connect(Config.DATABASE_URI)
    await Handlers.registerAllHandlers()
    setTimeout(() => {
      test.end()
    }, 10000)
  })


  handlersTest.test('registerAllHandlers should', registerAllHandlers => {
    registerAllHandlers.test('register all kafka handlers', async (test) => {
      const prepareSpy = Sinon.spy(TransferHandler, 'prepare')
      // const positionSpy = Sinon.spy(PositionHandler.positions)
      // const transferSpy = Sinon.spy(TransferHandler.transfer)
      // const notificationSpy = Sinon.spy(NotificationHandler.mockNotification)
      const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, 'TRANSFER', 'PREPARE')
      config.logger = Logger
      const response = await Producer.produceMessage(messageProtocol, topicConf, config)
      // setTimeout(() => {
      //   clearTimeout()
      //   test.fail()
      //   TransferHandler.prepare.restore()
      //   test.end()
      // }, 100000)
      wait.for.value(TransferHandler.prepare, 'called', true)
      // wait.for.value(positionSpy, 'called', true)
      // wait.for.value(transferSpy, 'called', true)
      // wait.for.value(notificationSpy, 'called', true)
      test.equal(response, true)
      TransferHandler.prepare.restore()
      test.end()
      // positionSpy.restore()
      // transferSpy.restore()
      // notificationSpy.restore()
    })

    registerAllHandlers.end()
  })

  handlersTest.end()
})

Test.onFinish(async (test) => {
  await Producer.disconnect()
  test.end()
})
