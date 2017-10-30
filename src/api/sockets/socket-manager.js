'use strict'

const RequestLogger = require('./../../lib/request-logger')

class SocketManager {
  constructor () {
    this._sockets = []
  }

  _remove (ws) {
    this._sockets.splice(this._sockets.indexOf(ws), 1)
  }

  _addSocket (ws) {
    if (!this._sockets.includes(ws)) {
      this._sockets.push(ws)
      ws.once('close', () => {
        this._remove(ws)
      })
    }
  }

  _findSocketsForAccount (name) {
    return this._sockets.filter(x => x.accounts.includes(name))
  }

  add (ws, ...accounts) {
    if (accounts.length <= 0) {
      ws.close()
    } else {
      ws.accounts = accounts
      this._addSocket(ws)
    }
  }

  send (name, message) {
    const jsonMessage = JSON.stringify(message)
    this._findSocketsForAccount(name)
      .forEach(s => {
        RequestLogger.logWebsocket(JSON.stringify({ name, message }))
        s.send(jsonMessage)
      })
  }
}

module.exports = {
  create: () => new SocketManager()
}
