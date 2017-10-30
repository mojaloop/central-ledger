'use strict'

exports.sum = function (position1, position2) {
  return {
    payments: position1.payments.plus(position2.payments),
    receipts: position1.receipts.plus(position2.receipts),
    net: position1.net.plus(position2.net)
  }
}
