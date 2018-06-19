'use strict'

const Validator = require('./validator')
const Events = require('../../lib/events')
const Sidecar = require('../../lib/sidecar')

const sendMessage = async function (request, h) {
  Sidecar.logRequest(request)
  const message = await Validator.validate(request.payload)
  Events.sendMessage(message)
  return h.response().code(201)
}

module.exports = {
  sendMessage
}
