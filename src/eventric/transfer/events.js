'use strict'

const Util = require('../../lib/util')

module.exports = {
  TransferPrepared (proposed) {
    return Util.assign(this, proposed)
  },

  TransferExecuted (fulfillment) {
    return Util.assign(this, fulfillment)
  },

  TransferRejected (rejection) {
    return Util.assign(this, rejection)
  },

  TransferSettled (settlement) {
    return Util.assign(this, settlement)
  }
}
