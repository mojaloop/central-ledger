'use strict'

const Client = require('@mojaloop/forensic-logging-client')
const NullClient = require('./nullClient')
const Config = require('../config')
const Moment = require('moment')

const sidecar = createClient()

function createClient () {
  if (Config.SIDECAR_DISABLED) {
    return NullClient.create()
  }

  let sc = Client.create({
    host: Config.SIDECAR.HOST,
    port: Config.SIDECAR.PORT,
    connectTimeout: Config.SIDECAR.CONNECT_TIMEOUT,
    reconnectInterval: Config.SIDECAR.RECONNECT_INTERVAL
  })

  sc.on('close', () => {
    throw new Error('Sidecar connection closed')
  })

  return sc
}

exports.connect = () => {
  return sidecar.connect()
}

exports.write = (msg) => {
  return sidecar.write(msg)
}

exports.logRequest = (request) => {
  const msg = {
    method: request.method,
    timestamp: Moment.utc().toISOString(),
    url: request.url.path,
    body: request.body,
    auth: request.auth
  }
  return sidecar.write(JSON.stringify(msg))
}
