'use strict'

const Logger = require('@mojaloop/central-services-logger')
const Util = require('util')

const logRequest = function (request) {
  const traceId = request.headers.traceid
  Logger.isDebugEnabled && Logger.debug(`L1p-Trace-Id=${traceId} - Method: ${request.method}, Path: ${request.path}, Query: ${JSON.stringify(request.query)}`)
  Logger.isDebugEnabled && Logger.debug(`L1p-Trace-Id=${traceId} - Headers: ${JSON.stringify(request.headers, null, 2)}`)
  if (request.payload) {
    Logger.isDebugEnabled && Logger.debug(`L1p-Trace-Id=${traceId} - Body: ${JSON.stringify(request.payload, null, 2)}`)
  }
}

const logResponse = function (request) {
  const traceId = request.headers.traceid
  if (request.response) {
    let response
    try {
      response = JSON.stringify(request.response, null, 2)
    } catch (e) {
      response = Util.inspect(request.response)
    }
    if (!response) {
      Logger.isDebugEnabled && Logger.debug(`L1p-Trace-Id=${traceId} - Response: ${request.response}`)
    } else {
      Logger.isDebugEnabled && Logger.debug(`L1p-Trace-Id=${traceId} - Response: ${response}, Status: ${request.response.statusCode}, Stack: ${request.response.stack}`)
    }
  }
}

const logWebsocket = function (data) {
  Logger.isInfoEnabled && Logger.info(`Websocket: ${data}`)
}

module.exports = {
  logRequest,
  logResponse,
  logWebsocket
}
