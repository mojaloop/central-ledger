'use strict'

// const Eventric = require('../../../eventric')
const Translator = require('../translator')
const Events = require('../../../lib/events')
const Kafka = require('../kafka')
// const Config = require('../../../lib/config')
const Logger = require('@mojaloop/central-services-shared').Logger
const UrlParser = require('../../../lib/urlparser')
const Socket = require('../../../api/sockets')
const Projection = require('../../../domain/transfer/projection')
const Query = require('../../../domain/transfer/queries')

// const Errors = require('../../errors')

// *** Original prepare function
// const prepare = (transfer) => {
//   return Eventric.getContext().then(ctx => ctx.command('PrepareTransfer', transfer))
// }

// *** POC prepare function that publishes messages to Kafka topics
const prepare = async (message) => {
  const {id, ledger, debits, credits, execution_condition, expires_at} = message
  var t = Translator.fromPayload(message)
  Logger.info(`L1p-Trace-Id=${t.id} - Transfers.Commands.prepare::start`)
  const existingTransfer = await Query.getById(UrlParser.idFromTransferUri(message.id))
  if (existingTransfer) {
    Logger.info('Transfer.Command.prepare.duplicateTransfer:: existingTransfer= %s', JSON.stringify(existingTransfer))
    Logger.info(`L1p-Trace-Id=${t.id} - Transfers.Commands.prepare::end`)
    return {
      existing: true,
      transfer: Translator.toTransfer(existingTransfer)
    }
  }
  message.timeline = {
    prepared_at: new Date()
  }
  return new Promise((resolve, reject) => {
    // Logger.info(`Transfers.Commands.prepare:: message='${message}'`)
    // const {id, ledger, debits, credits, execution_condition, expires_at} = message
    // var t = Translator.fromPayload(message)
    // t = Translator.toTransfer(message)
    // Logger.info(`L1p-Trace-Id=${t.id} - Transfers.Commands.prepare::start`)
    var topic = Kafka.getPrepareTxTopicName(t)
    // Logger.info('Transfers.Commands.prepare:: emit PublishMessage(%s, %s, %s)', topic, id, JSON.stringify(t))
    // Events.emitPublishMessage(topic, id, t)
    // return resolve({ existing: result.existing, transfer: t })
    // return Kafka.send(topic, id, t).then(result => {
    return Kafka.Producer.send({topic, key: id, message: JSON.stringify(message)}).then(result => {
      var response = {}
      message.state = 'prepared'
      if (result) {
        response = {status: 'pending', existing: false, transfer: message}
        Logger.info(`Transfers.Commands.prepare:: result='${JSON.stringify(response)}'`)
        Logger.info(`L1p-Trace-Id=${t.id} - Transfers.Commands.prepare::end`)
        return resolve(response)
      } else {
        response = {status: 'pending-failed', existing: false, transfer: message}
        Logger.info(`Transfers.Commands.prepare:: result='${JSON.stringify(response)}'`)
        return reject(response)
      }
    }).catch(reason => {
      Logger.error(`Transfers.Commands.prepare:: ERROR:'${reason}'`)
      return reject(reason)
    })
  })
}

// *** POC prepare function that Consumes Prepare messages from Kafka topics
const prepareExecute = async (payload, done) => {
  var unTranslatedTransfer = JSON.parse(payload.value)
  const transfer = Translator.fromPayload(unTranslatedTransfer)
  Logger.info(`L1p-Trace-Id=${transfer.id} - Transfers.Commands.prepareExecute::start`)
  // Logger.info('Transfers.prepareExecute.entry')
  // utility function promise to send notifications to the kafka publisher
  const sendNotificationPromise = (notificationTopic, notificationMsg, id) => {
    return new Promise(function (resolve, reject) {
      return Kafka.Producer.sendNotify({
        topic: notificationTopic,
        key: id,
        message: JSON.stringify(notificationMsg)
      }).then(result => {
        if (result) {
          return resolve(true)
        } else {
          return reject(false)
        }
      }).catch(reason => {
        Logger.error(`Transfers.prepareExecute.sendNotificationPromise:: ERROR:'${reason}'`)
        return reject(reason)
      })
    })
  }

// const prepareExecute = (payload, done) => {
//   var unTranslatedTransfer = JSON.parse(payload.value)
//   const transfer = Translator.fromPayload(unTranslatedTransfer)
  // Logger.info(`L1p-Trace-Id=${transfer.id} - Transfers.Commands.prepareExecute::start`)
  await Projection.saveTransferPrepared(transfer).then(result => {
    return new Promise(async function (resolve, reject) {
      if (result) {
        // Logger.info('Transfer.Command.prepareExecute:: result= %s', JSON.stringify(result))
        const {id, ledger, debits, credits, execution_condition, expires_at} = transfer

        // Events.emitPublishMessage(topic, id, result)
        // CALCULATE THE POSITION
        //  1. read the latest position from the topic
        //  2. calculate the position
        //  3. publish position
        // const topicForPositions = Kafka.getPreparePositionTopicName(transfer)
        // const kafkaOptions = Config.TOPICS_KAFKA_CONSUMER_OPTIONS
        // var groupId = kafkaOptions.groupId
        // Kafka.ConsumerOnceOff(groupId, topicForPositions, null)
        // Kafka.ConsumerOnceOff(groupId, topicForPositions,
        //   (payload, cb) => {
        //     var positionPayload = JSON.parse(payload.value)
        //     return new Promise((resolve, reject) => {
        //       Logger.info(`positionPayload = ${JSON.stringify(positionPayload)}`)
        //       cb()
        //       return resolve(true)
        //     })
        //   }).then(result => {
        //     var response = result
        //     const topicForNotifications = Kafka.getPrepareNotificationTopicName(transfer)
        //     return Kafka.send(topicForNotifications, id, result).then(result => {
        //       if (result) {
        //         done()
        //         return resolve(response)
        //       } else {
        //         done()
        //         return reject(response)
        //       }
        //     }).catch(reason => {
        //       Logger.error(`Transfers.Commands.prepare:: ERROR:'${reason}'`)
        //       done()
        //       return reject(reason)
        //     })
        //   })
        var response = await Query.getById(id)
        // const topicForNotifications = Kafka.getPrepareNotificationTopicName(transfer)
        var notificationMsgForDebits = {
          from: transfer.debits[0].account,
          to: transfer.debits[0].account,
          payload: Translator.toTransfer(response)
        }
        var notificationMsgForCredits = {
          from: transfer.debits[0].account,
          to: transfer.credits[0].account,
          payload: Translator.toTransfer(response)
        }

        const topicForDebitNotifications = Kafka.tansformAccountToPrepareNotificationTopicName(UrlParser.nameFromAccountUri(notificationMsgForDebits.to))
        const topicForCreditNotifications = Kafka.tansformAccountToPrepareNotificationTopicName(UrlParser.nameFromAccountUri(notificationMsgForCredits.to))
        /* const debitNotificationPromise = new Promise(function (resolve, reject) {
          return Kafka.Producer.send({
            topic: topicForDebitNotifications,
            key: id,
            message: JSON.stringify(notificationMsgForDebits)
          }).then(result => {
            // return Kafka.send(topicForNotifications, id, result).then(result => {
            if (result) {
              done()
              Logger.info('result debit true')
              return resolve(true)
            } else {
              done()
              Logger.info('result debit false')
              return reject(false)
            }
          }).catch(reason => {
            Logger.error(`Transfers.prepareExecute.prepare.debit:: ERROR:'${reason}'`)
            done() // TODO: Need to handle errors for Prepare Execution process
            return reject(reason)
          })
        }) */
        return Promise.all([sendNotificationPromise(topicForDebitNotifications, notificationMsgForDebits, id), sendNotificationPromise(topicForCreditNotifications, notificationMsgForCredits, id)]).then(result => {
          if (result) {
            done()
            Logger.info('Transfer.Command.prepareExecute:: result= %s', JSON.stringify(result))
            Logger.info(`L1p-Trace-Id=${transfer.id} - Transfers.Commands.prepareExecute::end`)
            return resolve(response)
          } else {
            done()
            return reject(response)
          }
        }).catch(reason => {
          Logger.error(`Transfers.prepareExecute.sendNotificationPromise:: ERROR:'${reason}'`)
          done() // TODO: Need to handle errors for Prepare Execution process
          return reject(reason)
        })
        // TODO: WS Notifications to be re-worked so that it sends a notification to each DFSP
      } else {
        done() // TODO: Need to handle errors for Prepare Execution process
        reject(result)
      }
    })
  }).catch(reason => {
    done()
    Logger.error(`Transfers.Commands.prepareExecute.group:: ERROR:'${reason}'`)
    return reject(reason) // TODO: Need to handle errors for Prepare Execution process
  })
}

// *** POC prepare function that Consumes Prepare Notifications messages from Kafka topics
const prepareNotification = (payload, done) => {
  var jsonPayload = JSON.parse(payload.value)
  return new Promise(function (resolve, reject) {
    // var t = Translator.fromPayload(message)
    var t = Translator.fromPayload(jsonPayload.payload)
    Logger.info(`L1p-Trace-Id=${t.id} - Transfers.Commands.prepareNotification::start`)
    Logger.info('Transfer.Commands.prepareNotification:: result= %s', JSON.stringify(jsonPayload))
    // jsonPayload.to = jsonPayload.transfer.debits[0].account
    // Events.emitTransferPrepared(jsonPayload) // May need to re-work this to be synchronous
    Socket.send(jsonPayload.to, jsonPayload.payload).then(result => {
      done()
      return resolve(result)
    })
    Logger.info(`L1p-Trace-Id=${t.id} - Transfers.Commands.prepareNotification::end`)
    return resolve(true)
  }) // TODO: Need to handle errors for Prepare Notification process
}

const fulfill = (fulfillment) => {
  return null // Eventric.getContext().then(ctx => ctx.command('FulfillTransfer', fulfillment))
}

const reject = (rejection) => {
  return null // Eventric.getContext().then(ctx => ctx.command('RejectTransfer', rejection))
}

const settle = ({id, settlement_id}) => {
  return null // Eventric.getContext().then(ctx => ctx.command('SettleTransfer', {id, settlement_id}))
}

module.exports = {
  fulfill,
  prepare,
  prepareExecute,
  reject,
  settle,
  prepareNotification
}
