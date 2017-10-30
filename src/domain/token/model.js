'use strict'

const Db = require('../../db')
const Time = require('../../lib/time')

const create = ({ accountId, token, expiration }) => {
  return Db.tokens.insert({
    accountId,
    token,
    expiration
  })
}

const byAccount = ({ accountId }) => {
  return Db.tokens.find({ accountId: accountId })
}

const removeExpired = () => {
  return Db.tokens.destroy({ 'expiration <=': Time.getCurrentUTCTimeInMilliseconds() })
}

module.exports = {
  create,
  byAccount,
  removeExpired
}
