'use strict'

exports.sum = function (position1, position2) {
  return {
    payments: position1.payments + position2.payments,
    receipts: position1.receipts + position2.receipts,
    net: position1.net + position2.net
  }
}
