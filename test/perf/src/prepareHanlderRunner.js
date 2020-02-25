const prepareHanler = require('../../../src/handlers/transfers/handler').prepare
const uuidv4 = require('uuid/v4')
// ['dfsp1', 'dfsp2', 'dfsp3', 'dfsp4']

function setImmediatePromise () {
  return new Promise((resolve) => {
    setImmediate(() => resolve())
  })
}

const generateTransfer = () => {
  return {
    transferId: uuidv4(),
    payerFsp: 'simfsp01',
    payeeFsp: 'simfsp02',
    amount: {
      currency: 'USD',
      amount: '1'
    },
    ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
    condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
    expiration: '2025-01-20T08:38:08.699-04:00'
    // extensionList: {
    //   extension: [
    //     {
    //       key: 'key1',
    //       value: 'value1'
    //     },
    //     {
    //       key: 'key2',
    //       value: 'value2'
    //     }
    //   ]
    // }
  }
}

const generateProtocolMessage = () => {
  const transfer = generateTransfer()
  return {
    value: {
      id: uuidv4(),
      from: transfer.payerFsp,
      to: transfer.payeeFsp,
      type: 'application/json',
      content: {
        headers: { 'fspiop-destination': transfer.payeeFsp, 'fspiop-source': transfer.payerFsp },
        uriParams: { id: transfer.transferId },
        payload: transfer
      },
      metadata: {
        event: {
          id: uuidv4(),
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
  }
}

module.exports.prepareHanlderRunner = async (numberOfMessages = 0, durationSeconds = 0) => {
  if (numberOfMessages) {
    for (let i; i < numberOfMessages; i++) {
      await prepareHanler(null, generateProtocolMessage())
      await setImmediatePromise()
      return true
    }
  } else if (durationSeconds) {
    // const startDate = (new Date()).getTime()
    // while ((new Date()).getTime() < startDate + )
    throw new Error('not implemented')
  } else {
    while (true) {
      await prepareHanler(null, [generateProtocolMessage()])
      await setImmediatePromise()
    }
  }
}
