'use strict'

const Db = require('../../../db')
// const Moment = require('moment')
const Util = require('../../../lib/util')
// const Time = require('../../../lib/time')

exports.create = async (transfer) => {
  try {
    return await Db.ilp.insert({
      transferId: transfer.transferId,
      packet: transfer.packet,
      condition: transfer.condition,
      fulfilment: transfer.fulfilment
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

// exports.getById = async (id) => {
//   try {
//     return await Db.ilp.findOne({ ilpId: id })
//   } catch (err) {
//     throw new Error(err.message)
//   }
// }

exports.getByTransferId = async (transferId) => {
  try {
    return await Db.ilp.query(async (builder) => {
      return builder
        .where({'ilp.transferId': transferId})
        // .where('expirationDate', '>', `${Time.getCurrentUTCTimeInMilliseconds()}`)
        .innerJoin('transfer as transfer', 'transfer.transferId', 'ilp.transferId')
        .select('ilp.*')
        .select('transfer.*')
        .first()
    })
    // return await Db.ilp
    //   .findOne({ transferId: transferId })
    //   .innerJoin('transfer', 'transfer.transferId', 'ilp.transferId')
    //   .where('expirationDate', '>', `${Time.getCurrentUTCTimeInMilliseconds()}`) // or maybe ${Moment.utc().toISOString()}
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.update = async (ilp, payload) => {
  const fields = {
    transferId: ilp.transferId,
    packet: payload.packet || payload.ilpPacket,
    condition: payload.condition,
    fulfilment: payload.fulfilment
  }
  try {
    return await Db.ilp.update({ilpId: ilp.ilpId}, Util.filterUndefined(fields))
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.destroyByTransferId = async (ilp) => {
  try {
    return await Db.ilp.destroy({transferId: ilp.transferId})
  } catch (err) {
    throw new Error(err.message)
  }
}
