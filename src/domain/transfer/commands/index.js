'use strict'

const Eventric = require('../../../eventric')
const Translator = require('../translator')
const Events = require('../../../lib/events')
const Logger = require('@mojaloop/central-services-shared').Logger
// const Errors = require('../../errors')

// const prepare = (transfer) => {
//   return Eventric.getContext().then(ctx => ctx.command('PrepareTransfer', transfer))
// }

const prepare = (transfer) => {
  Logger.info('Command:prepare::start(%s)', JSON.stringify(transfer))
  // for future to check if prepare already exists then return { existing: true, transfer: existing }
  var response = { existing: false, transfer }
  Logger.info('Command:prepare::end=%s', JSON.stringify(response))
  return new Promise(function (fulfill, reject) {
    fulfill(response)
  })
}

const prepareExecute = (transfer) => {
  return Eventric.getContext().then(ctx => ctx.command('PrepareTransfer', transfer)).then(result => {
    // const t = Translator.toTransfer(result.transfer)
    // const { id, ledger, debits, credits, execution_condition, expires_at } = transfer
    // const topic = getPrepareNotificationTopicName(debits[0].account)
    // Events.emitPublishMessage(topic, t)
    return new Promise(function (fulfill, reject) {
      if (result) {
        Logger.info('prepareExecute::result= %s', JSON.stringify(result))
        // const {id, ledger, debits, credits, execution_condition, expires_at} = transfer
        // const topic = getPrepareNotificationTopicName(debits[0].account)
        // Events.emitPublishMessage(topic, t)
      }
      fulfill(result)
    })
  }).catch(error => {
    Logger.info('HOLYSHIT! %s', error)
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
