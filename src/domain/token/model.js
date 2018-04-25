'use strict'

const Db = require('../../db')
const Time = require('../../lib/time')

const create = ({ participantId, token, expiration }) => {
  return Db.tokens.insert({
    participantId,
    token,
    expiration
  })
}

const byParticipant = ({ participantId }) => {
  return Db.tokens.find({ participantId: participantId })
}

const removeExpired = () => {
  return Db.tokens.destroy({ 'expiration <=': Time.getCurrentUTCTimeInMilliseconds() })
}

module.exports = {
  create,
  byParticipant,
  removeExpired
}
