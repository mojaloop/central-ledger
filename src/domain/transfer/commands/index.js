'use strict'

const Eventric = require('../../../eventric')
const Translator = require('../translator')
const Events = require('../../../lib/events')
const Kafka = require('../kafka')
const Config = require('../../../lib/config')
const Logger = require('@mojaloop/central-services-shared').Logger
// const Errors = require('../../errors')

// const prepare = (transfer) => {
//   return Eventric.getContext().then(ctx => ctx.command('PrepareTransfer', transfer))
// }

const prepare = async (message) => {
  return new Promise((resolve, reject) => {
    Logger.info(`Transfers.Commands.prepare:: message='${message}'`)
    const { id, ledger, debits, credits, execution_condition, expires_at } = message
    const t = Translator.toTransfer(message)
    var topic = Kafka.getPrepareTxTopicName(t)
    // Logger.info('Transfers.Commands.prepare:: emit PublishMessage(%s, %s, %s)', topic, id, JSON.stringify(t))
    // Events.emitPublishMessage(topic, id, t)
    // return resolve({ existing: result.existing, transfer: t })
    return Kafka.send(topic, id, t).then(result => {
      var response = {}
      if (result) {
        response = { status: 'pending', existing: false, transfer: message }
        return resolve(response)
      } else {
        response = { status: 'pending-failed', existing: false, transfer: message }
        return reject(response)
      }
    }).catch(reason => {
      Logger.error(`Transfers.Commands.prepare:: ERROR:'${reason}'`)
      return reject(reason)
    })
  })
}
const prepareExecute = (payload, cb) => {
// const prepareExecute = (payload, cb) => {
  var unTranslatedTransfer = JSON.parse(payload.value)
  const transfer = Translator.fromPayload(unTranslatedTransfer)
  return Eventric.getContext().then(ctx => ctx.command('PrepareTransfer', transfer)).then(result => {
    return new Promise(function (resolve, reject) {
      if (result) {
        Logger.info('Transfer.Command.prepareExecute:: result= %s', JSON.stringify(result))
        const {id, ledger, debits, credits, execution_condition, expires_at} = transfer

        // Events.emitPublishMessage(topic, id, result)
        // CALCULATE THE POSITION
        //  1. read the latest position from the topic
        //  2. calculate the position
        //  3. publish position
        // const topicForPositions = Kafka.getPreparePositionTopicName(transfer)
        // const kafkaOptions = Config.TOPICS_KAFKA_CONSUMER_OPTIONS
        // var groupId = kafkaOptions.groupId
        // Kafka.ConsumerOnceOff(groupId, topicForPositions,
        //   (payload, cb) => {
        //     var positionPayload = JSON.parse(payload.value)
        //     return new Promise((resolve, reject) => {
        //       Logger.info(`positionPayload = ${JSON.stringify(positionPayload)}`)
        //       return resolve(true)
        //     })
        //   })
        var response = result
        const topicForNotifications = Kafka.getPrepareNotificationTopicName(transfer)
        return Kafka.send(topicForNotifications, id, result).then(result => {
          if (result) {
            cb()
            return resolve(response)
          } else {
            cb()
            return reject(response)
          }
        }).catch(reason => {
          Logger.error(`Transfers.Commands.prepare:: ERROR:'${reason}'`)
          cb()
          return reject(reason)
        })
      } else {
        cb()
        reject(result)
      }
    })
  }).catch(reason => {
    cb()
    Logger.error(`Transfers.Commands.prepareExecute:: ERROR:'${reason}'`)
    return reject(reason)
  })
}

// const prepareExecute = (unTranslatedTransfer) => {
//   const transfer = Translator.fromPayload(unTranslatedTransfer)
//   return Eventric.getContext().then(ctx => ctx.command('PrepareTransfer', transfer)).then(result => {
//     return new Promise(function (resolve, reject) {
//       if (result) {
//         Logger.info('Transfer.Command.prepareExecute:: result= %s', JSON.stringify(result))
//         const {id, ledger, debits, credits, execution_condition, expires_at} = transfer
//
//         // Events.emitPublishMessage(topic, id, result)
//         // CALCULATE THE POSITION
//         //  1. read the latest position from the topic
//         //  2. calculate the position
//         //  3. publish position
//
//         // var posTopicName = Kafka.getPreparePositionTopicName(transfer)
//         // const kafkaOptions = Config.TOPICS_KAFKA_CONSUMER_OPTIONS
//         // var groupId = kafkaOptions.groupId
//         // Kafka.createOnceOffConsumerGroup(groupId,
//         //   (message) => {
//         //     return new Promise((resolve, reject) => {
//         //       Logger.info(`messagemessagemessage: ${message}`)
//         //       return resolve(true)
//         //     })
//         //   }, posTopicName, kafkaOptions).then(result => {
//         //     var response = result
//         //     const topicForNotifications = Kafka.getPrepareNotificationTopicName(transfer)
//         //     return Kafka.send(topicForNotifications, id, result).then(result => {
//         //       if (result) {
//         //         return resolve(response)
//         //       } else {
//         //         return reject(response)
//         //       }
//         //     }).catch(reason => {
//         //       Logger.error(`Transfers.Commands.prepare:: ERROR:'${reason}'`)
//         //       return reject(reason)
//         //     })
//         //   })
//
//         var response = result
//         const topicForNotifications = Kafka.getPrepareNotificationTopicName(transfer)
//         return Kafka.send(topicForNotifications, id, result).then(result => {
//           if (result) {
//             return resolve(response)
//           } else {
//             return reject(response)
//           }
//         }).catch(reason => {
//           Logger.error(`Transfers.Commands.prepare:: ERROR:'${reason}'`)
//           return reject(reason)
//         })
//       } else {
//         reject(result)
//       }
//     })
//   }).catch(reason => {
//     Logger.error(`Transfers.Commands.prepareExecute:: ERROR:'${reason}'`)
//     return reject(reason)
//   })
// }

const prepareNotification = (payload, cb) => {
  var transfer = JSON.parse(payload.value)
  return new Promise(function (resolve, reject) {
    Logger.info('Transfer.Commands.prepareNotification:: result= %s', JSON.stringify(transfer))
    Events.emitTransferPrepared(payload)
    cb()
    return resolve(true)
  })
}

// const prepareNotification = (payload) => {
//   return new Promise(function (resolve, reject) {
//     Logger.info('Transfer.Commands.prepareNotification:: result= %s', JSON.stringify(payload))
//     Events.emitTransferPrepared(payload)
//     return resolve(true)
//   })
// }

const fulfill = (fulfillment) => {
  return Eventric.getContext().then(ctx => ctx.command('FulfillTransfer', fulfillment))
}

const reject = (rejection) => {
  return Eventric.getContext().then(ctx => ctx.command('RejectTransfer', rejection))
}

const settle = ({id, settlement_id}) => {
  return Eventric.getContext().then(ctx => ctx.command('SettleTransfer', {id, settlement_id}))
}

module.exports = {
  fulfill,
  prepare,
  prepareExecute,
  reject,
  settle,
  prepareNotification
}
