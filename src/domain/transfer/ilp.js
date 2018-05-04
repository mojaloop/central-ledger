const Model = require('./models/ilp-model')

// TODO add validations?

const create = async ({ transferId, packet, condition, fullfilment }) => {
  return await Model.create({ transferId, packet, condition, fullfilment })
}

const update = async (transferId, payload) => {
  try {
    const ilp = await Model.getByTransferId(transferId)
    if (!ilp) {
      throw new Error('transfer for this ILP not found or expired')
    }
    return await Model.update
  } catch (err) {
    throw new Error(err.message)
  }
}

module.exports = {
  create,
  update
}
