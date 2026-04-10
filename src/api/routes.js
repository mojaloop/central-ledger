'use strict'

module.exports = {
  name: 'api routes',
  register: function (server) {
    server.route(require('./root/routes'))
    server.route(require('./participants/routes'))
    server.route(require('./transactions/routes'))
    server.route(require('./settlementModels/routes'))
    // This can likely be removed, it was being consumed by central-settlements.
    server.route(require('./ledgerAccountTypes/routes'))
  }
}
