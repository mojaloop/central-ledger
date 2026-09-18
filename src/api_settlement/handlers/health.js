'use strict'

// Reuse the existing health handler from central-ledger.
// We should remove this separate health check altogether, we need to update the Golden path
// tests first.
const { getHealth } = require('../../../api/root/handler')

module.exports = {
  get: getHealth
}
