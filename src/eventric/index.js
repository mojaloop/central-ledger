const Eventric = require('eventric')
const P = require('bluebird')
const KnexStore = require('./knex-store')
const Transfer = require('./transfer')

let initializedContext

exports.getContext = () => {
  if (!initializedContext) {
    Eventric.setStore(KnexStore.default, {})
    const context = Eventric.context('Ledger')
    Transfer.setupContext(context)
    initializedContext = P.resolve(context.initialize())
      .then(() => context)
  }

  return initializedContext
}
