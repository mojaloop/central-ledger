'use strict'

const Eventric = require('../../../eventric')
const Translator = require('../translator')
const Events = require('../../../lib/events')
const Kafka = require('../kafka')
// const Config = require('../../../lib/config')
const Logger = require('@mojaloop/central-services-shared').Logger
// const Errors = require('../../errors')

// *** Original prepare function
// const prepare = (transfer) => {
//   return Eventric.getContext().then(ctx => ctx.command('PrepareTransfer', transfer))
// }

// *** POC prepare function that publishes messages to Kafka topics
const prepare = async (message) => {
  return new Promise((resolve, reject) => {
    // Logger.info(`Transfers.Commands.prepare:: message='${message}'`)
    const { id, ledger, debits, credits, execution_condition, expires_at } = message
    const t = Translator.toTransfer(message)
    var topic = Kafka.getPrepareTxTopicName(t)
    // Logger.info('Transfers.Commands.prepare:: emit PublishMessage(%s, %s, %s)', topic, id, JSON.stringify(t))
    // Events.emitPublishMessage(topic, id, t)
    // return resolve({ existing: result.existing, transfer: t })
    // return Kafka.send(topic, id, t).then(result => {
    return Kafka.Producer.send({topic, key: id, message: JSON.stringify(t)}).then(result => {
      var response = {}
      if (result) {
        response = { status: 'pending', existing: false, transfer: message }
        Logger.info(`Transfers.Commands.prepare:: result='${JSON.stringify(response)}'`)
        return resolve(response)
      } else {
        response = { status: 'pending-failed', existing: false, transfer: message }
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
const prepareExecute = (payload, done) => {
// const prepareExecute = (payload, done) => {
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
        var response = result
        const topicForNotifications = Kafka.getPrepareNotificationTopicName(transfer)
        return Kafka.Producer.send({topic: topicForNotifications, key: id, message: JSON.stringify(result)}).then(result => {
        // return Kafka.send(topicForNotifications, id, result).then(result => {
          if (result) {
            done()
            return resolve(response)
          } else {
            done()
            return reject(response)
          }
        }).catch(reason => {
          Logger.error(`Transfers.prepareExecute.prepare:: ERROR:'${reason}'`)
          done() // TODO: Need to handle errors for Prepare Execution process
          return reject(reason)
        })
      } else {
        done() // TODO: Need to handle errors for Prepare Execution process
        reject(result)
      }
    })
  }).catch(reason => {
    done()
    Logger.error(`Transfers.Commands.prepareExecute:: ERROR:'${reason}'`)
    return reject(reason) // TODO: Need to handle errors for Prepare Execution process
  })
}

// *** POC prepare function that Consumes Prepare Notifications messages from Kafka topics
const prepareNotification = (payload, done) => {
  var jsonPayload = JSON.parse(payload.value)
  return new Promise(function (resolve, reject) {
    Logger.info('Transfer.Commands.prepareNotification:: result= %s', JSON.stringify(jsonPayload))
    Events.emitTransferPrepared(jsonPayload.transfer) // May need to re-work this to be synchronous
    done()
    return resolve(true)
  }) // TODO: Need to handle errors for Prepare Notification process
}

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
