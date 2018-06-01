'use strict'

const WS = require('ws')
const Url = require('url')
const Uuid = require('uuid4')
const Events = require('../../lib/events')
const SocketManager = require('./socket-manager')
const WebSocket = require('./websocket')
const ParticipantTransfers = require('./participant-transfers')

let manager

const createWebSocketServer = (listener) => {
  return new WS.Server({
    server: listener
  })
}

const getParticipants = (transfer) => {
  const credits = transfer.credits || []
  const debits = transfer.debits || []
  return [...credits, ...debits].map(c => c.participant)
}

const wireConnection = (webSocketServer) => {
  webSocketServer.on('connection', (ws) => {
    const url = ws.upgradeReq.url
    const path = Url.parse(url).pathname
    if (path === '/websocket') {
      WebSocket.initialize(ws, manager)
    } else {
      ParticipantTransfers.initialize(ws, url, manager)
    }
  })
}

const transferHandler = (event) => {
  return (msg) => {
    const resource = formatResource(event, msg.resource, msg.related_resources)
    getParticipants(msg.resource).forEach(participant => manager.send(participant, resource))
  }
}

const formatResource = (event, resource, relatedResources) => {
  const params = {
    event: event,
    id: Uuid(),
    resource: resource
  }
  if (relatedResources) {
    params.related_resources = relatedResources
  }
  return {
    jsonrpc: '2.0',
    id: null,
    method: 'notify',
    params
  }
}

const messageHandler = (message) => {
  const toParticipant = message.to
  manager.send(toParticipant, formatResource('message.send', message))
}

const wireEvents = () => {
  Events.onTransferPrepared(transferHandler('transfer.create'))
  Events.onTransferExecuted(transferHandler('transfer.update'))
  Events.onTransferRejected(transferHandler('transfer.update'))
  Events.onMessageSent(messageHandler)
}

exports.plugin = {
  name: 'websockets',
  register: (server, options) => {
    manager = SocketManager.create()

    const wss = createWebSocketServer(server.listener)

    wireConnection(wss)

    wireEvents()
  }
}
