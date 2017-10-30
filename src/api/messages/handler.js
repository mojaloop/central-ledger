'use strict'

const Validator = require('./validator')
const Events = require('../../lib/events')
const Sidecar = require('../../lib/sidecar')

const sendMessage = (req, rep) => {
  Sidecar.logRequest(req)
  return Validator.validate(req.payload)
    .then(message => {
      Events.sendMessage(message)
      rep().code(201)
    })
    .catch(e => rep(e))
}

module.exports = {
  sendMessage
}
