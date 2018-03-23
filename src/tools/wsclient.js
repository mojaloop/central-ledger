#!/usr/bin/env node

/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

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

  const ws = new WebSocket(uri, {
    perMessageDeflate: false
  })

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

  ws.on('close', function close (code, reason) {
    logger(`disconnected - ${code}: ${reason}`)
  })
}

start(argv.uri, argv.a)
