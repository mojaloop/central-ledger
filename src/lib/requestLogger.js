'use strict'

const Logger = require('@mojaloop/central-services-logger')
const Util = require('util')

const logRequest = function (request) {
  const traceId = request.headers.traceid
  Logger.debug(`L1p-Trace-Id=${traceId} - Method: ${request.method} Path: ${request.url.path} Query: ${JSON.stringify(request.query)}`)
  Logger.debug(`L1p-Trace-Id=${traceId} - Headers: ${JSON.stringify(request.headers)}`)
  if (request.body) {
    Logger.debug(`L1p-Trace-Id=${traceId} - Body: ${request.body}`)
  }
}

const logResponse = function (request) {
  const traceId = request.headers.traceid
  if (request.response) {
    let response
    try {
      response = JSON.stringify(request.response.source)
    } catch (e) {
      response = Util.inspect(request.response.source)
    }
    if (!response) {
      Logger.debug(`L1p-Trace-Id=${traceId} - Response: ${request.response}`)
    } else {
      Logger.debug(`L1p-Trace-Id=${traceId} - Response: ${response} Status: ${request.response.statusCode}`)
    }
  }
}

const logWebsocket = function (data) {
  Logger.info(`Websocket: ${data}`)
}

module.exports = {
  logRequest,
  logResponse,
  logWebsocket
}
