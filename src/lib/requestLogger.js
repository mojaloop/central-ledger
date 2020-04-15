'use strict'

const Logger = require('@mojaloop/central-services-logger')
const Util = require('util')

const logRequest = function (request) {
  const traceId = request.headers.traceid
  Logger.isDebugEnabled && Logger.debug(`L1p-Trace-Id=${traceId} - Method: ${request.method} Path: ${request.url.path} Query: ${JSON.stringify(request.query)}`)
  Logger.isDebugEnabled && Logger.debug(`L1p-Trace-Id=${traceId} - Headers: ${JSON.stringify(request.headers)}`)
  if (request.body) {
    Logger.isDebugEnabled && Logger.debug(`L1p-Trace-Id=${traceId} - Body: ${request.body}`)
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
      Logger.isDebugEnabled && Logger.debug(`L1p-Trace-Id=${traceId} - Response: ${request.response}`)
    } else {
      Logger.isDebugEnabled && Logger.debug(`L1p-Trace-Id=${traceId} - Response: ${response} Status: ${request.response.statusCode}`)
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
