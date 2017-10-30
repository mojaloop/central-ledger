'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Transfer = require('../../../../src/eventric/transfer')
const TransferEvents = require('../../../../src/eventric/transfer/events')
const Aggregate = require('../../../../src/eventric/transfer/transfer')
const Commands = require('../../../../src/eventric/transfer/commands')
const TransfersProjection = require('../../../../src/domain/transfer/projection')
const SettleableTransfersProjection = require('../../../../src/eventric/transfer/settleable-transfers-projection')

Test('Index should', initializeTest => {
  initializeTest.test('setupContext should', setupTest => {
    setupTest.test('add transfer objects to context', t => {
      let context = {
        defineDomainEvents: Sinon.stub(),
        addAggregate: Sinon.stub(),
        addCommandHandlers: Sinon.stub(),
        addProjection: Sinon.stub()
      }
      Transfer.setupContext(context)
      t.ok(context.defineDomainEvents.calledWith(TransferEvents))
      t.ok(context.addAggregate.calledWith('Transfer', Aggregate))
      t.ok(context.addCommandHandlers.calledWith(Commands))
      t.ok(context.addProjection.calledWith(TransfersProjection))
      t.ok(context.addProjection.calledWith(SettleableTransfersProjection))

      t.end()
    })
    setupTest.end()
  })

  initializeTest.end()
})
