'use strict'

const Eventric = require('../../../eventric')
const Translator = require('../translator')
const Events = require('../../../lib/events')
const Kafka = require('../kafka')
const Logger = require('@mojaloop/central-services-shared').Logger
// const Errors = require('../../errors')

// const prepare = (transfer) => {
//   return Eventric.getContext().then(ctx => ctx.command('PrepareTransfer', transfer))
// }

const prepare = (transfer) => {
  // Logger.info('Transfer.Command.prepare:: start(%s)', JSON.stringify(transfer))
  // for future to check if prepare already exists then return { existing: true, transfer: existing }
  var response = { existing: false, transfer }
  // Logger.info('Transfer.Command.prepare:: end=%s', JSON.stringify(response))
  return new Promise(function (resolve, reject) {
    resolve(response)
  })
}

const prepareExecute = (unTranslatedTransfer) => {
  const transfer = Translator.fromPayload(unTranslatedTransfer)
  return Eventric.getContext().then(ctx => ctx.command('PrepareTransfer', transfer)).then(result => {
    return new Promise(function (resolve, reject) {
      if (result) {
        Logger.info('Transfer.Command.prepareExecute:: result= %s', JSON.stringify(result))
        const {id, ledger, debits, credits, execution_condition, expires_at} = transfer
        const topic = Kafka.getPrepareNotificationTopicName(transfer)
        Events.emitPublishMessage(topic, id, result)
      }
      resolve(result)
    })
  }).catch(reason => {
    Logger.info('Transfer.Command.prepareExecute:: ERROR! %s', reason)
  })
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
  settle
}
