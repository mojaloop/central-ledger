'use strict'

const Eventric = require('../../../eventric')
const Logger = require('@mojaloop/central-services-shared').Logger

const prepare = (transfer) => {
  Logger.info(`L1p-Trace-Id=${transfer.id} - Transfers.Commands.prepare::start`)
  return Eventric.getContext().then(ctx => ctx.command('PrepareTransfer', transfer))
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
  reject,
  settle
}
