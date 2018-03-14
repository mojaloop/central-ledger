'use strict'

const RequestLogger = require('./../../lib/request-logger')
const UrlParser = require('./../../lib/urlparser')

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
      // accounts.map(account => UrlParser.nameFromAccountUri(account))
      // const account = UrlParser.nameFromAccountUri(accounts)
      ws.accounts = accounts.map(account => UrlParser.nameFromAccountUri(account))
      // ws.accounts = accounts
      this._addSocket(ws)
    }
  }

  send (name, message) {
    const account = UrlParser.nameFromAccountUri(name)
    const jsonMessage = JSON.stringify(message)
    this._findSocketsForAccount(account)
      .forEach(s => {
        RequestLogger.logWebsocket(JSON.stringify({ account, message }))
        s.send(jsonMessage)
      })
  }
}

module.exports = {
  create: () => new SocketManager()
}
