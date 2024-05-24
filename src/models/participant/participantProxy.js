'use strict'

const Db = require('../../lib/db')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

exports.create = async (participantId, isProxy) => {
  try {
    const result = await Db.from('participantProxy').insert({
      participantId,
      isProxy
    })
    return result
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.checkParticipantProxy = async (id) => {
  try {
    const params = { participantId: id, isProxy: 1 }
    const participantProxy = await Db.from('participantProxy').findOne(params)
    return participantProxy ? 1 : 0
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.destroyByParticipantId = async (id) => {
  try {
    return await Db.from('participantProxy').destroy({ participantId: id })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
