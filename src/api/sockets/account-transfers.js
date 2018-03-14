'use strict'

const UrlParser = require('../../lib/urlparser')
const AccountService = require('../../domain/account')
const NotFoundError = require('../../errors').NotFoundError

const sendNotFoundAndClose = (socket, message) => {
  socket.send(JSON.stringify(new NotFoundError(message).payload))
  socket.close()
}

const initialize = (socket, uri, socketManager) => {
  return UrlParser.accountNameFromTransfersRoute(uri)
    .then(result => UrlParser.toAccountUri(result))
    .then(accountUri => {
      return AccountService.exists(accountUri)
        .then(account => socketManager.add(socket, accountUri)).then(result => {
          // TODO: LAZ to add code to register kafka consumer
        })
    })
    .catch(err => {
      sendNotFoundAndClose(socket, err.message || 'The requested account does not exist')
    })
}

module.exports = {
  initialize
}
