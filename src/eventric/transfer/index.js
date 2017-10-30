'use strict'

const Events = require('./events')
const Aggregate = require('./transfer')
const Commands = require('./commands')
const TransfersProjection = require('../../domain/transfer/projection')
const FeesProjection = require('../../domain/fee/projection')
const SettleableTransfersProjection = require('./settleable-transfers-projection')

exports.setupContext = (context) => {
  context.defineDomainEvents(Events)
  context.addAggregate('Transfer', Aggregate)
  context.addCommandHandlers(Commands)
  context.addProjection(TransfersProjection)
  context.addProjection(FeesProjection)
  context.addProjection(SettleableTransfersProjection)
}
