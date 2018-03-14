#!/usr/bin/env node

'use strict'

var argv = require('yargs')
  .usage('Usage: $0 [options]')
  .describe('uri', 'Websocket URI for Central Ledger e.g. "ws://localhost:3000/websocket"')
  .describe('a', 'DFSP Account URI e.g. "http://localhost:3000/dfsp1"')
  .demandOption(['u', 'a'])
  .default('u', 'ws://localhost:3000/websocket')
  .default('a', 'http://localhost:3000/dfsp1')
  .help('h')
  .alias('h', 'help')
  .alias('u', 'uri')
  .alias('a', 'account')
  .argv

const Moment = require('moment')

const logger = (message) => {
  console.log(`${Moment.utc().toISOString()} - ${message}`)
}

const start = (uri, accountUri) => {
  logger(`Starting Websocket with uri='${uri}', accountUri='${accountUri}'`)

  const WebSocket = require('ws')

  const ws = new WebSocket(uri)

  ws.on('open', function open () {
    const params = {
      accounts: [ accountUri ]
    }
    const registerMsg = {id: 1, jsonrpc: '2.0', method: 'subscribe_account', params}
    logger(`Sending registration message: ${JSON.stringify(registerMsg)}`)
    ws.send(JSON.stringify(registerMsg))
  })

  ws.on('message', function incoming (data) {
    const payload = JSON.parse(data)
    if (payload.id === 1 && payload.result === 1) {
      logger(`Registration completed`)
    } else if (payload.method === 'notify') {
      logger(`Notify received: ${data}`)
    } else {
      logger(`Message received: ${data}`)
    }
  })

  ws.on('error', function incoming (response, error) {
    if (error) {
      logger('error - ' + error)
    }
    logger(response)
  })

  ws.on('close', function close () {
    logger('disconnected')
  })
}

start(argv.uri, argv.a)
