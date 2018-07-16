'use strict'

const Validator = require('./validator')
const RequestLogger = require('./../../lib/requestLogger')

const initialize = (socket, socketManager) => {
  socket.send(JSON.stringify({ id: null, jsonrpc: '2.0', method: 'connect' }))

  socket.on('message', data => {
    RequestLogger.logWebsocket(data)
    Validator.validateSubscriptionRequest(data, (err, result) => {
      if (err) {
        socket.send(JSON.stringify(err.payload))
        socket.close()
      } else {
        socket.send(JSON.stringify({ id: result.id, jsonrpc: result.jsonrpc, result: result.participantUris.length }))
        socketManager.add(socket, ...result.participantUris)
      }
    })
  })
}

module.exports = {
  initialize
}
