'use strict'

const UrlParser = require('../../lib/urlParser')
const ParticipantService = require('../../domain/participant')
const NotFoundError = require('../../errors').NotFoundError

const sendNotFoundAndClose = (socket, message) => {
  socket.send(JSON.stringify(new NotFoundError(message).payload))
  socket.close()
}

const initialize = (socket, uri, socketManager) => {
  return UrlParser.participantNameFromTransfersRoute(uri)
    .then(result => UrlParser.toParticipantUri(result))
    .then(participantUri => {
      return ParticipantService.exists(participantUri)
        .then(participant => socketManager.add(socket, participantUri))
    })
    .catch(err => {
      sendNotFoundAndClose(socket, err.message || 'The requested participant does not exist')
    })
}

module.exports = {
  initialize
}
