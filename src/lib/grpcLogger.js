'use strict'
const eventSDK = require('@mojaloop/event-sdk')
const DefaultEventLogger = require('@mojaloop/event-sdk').DefaultEventLogger
const _ = require('lodash')

let grpcLogger
let rootSpan

const trace = async (message, service) => {
  if (!grpcLogger) {
    grpcLogger = new DefaultEventLogger()
  }
  let traceMessage = _.cloneDeep(message)
  traceMessage.metadata.event.type = eventSDK.TraceEventTypeAction.type
  traceMessage.metadata.event.action = eventSDK.TraceEventAction.span
  let response = await grpcLogger.createSpanForMessageEnvelope(traceMessage, service)
  message.metadata.trace = _.cloneDeep(traceMessage.metadata.trace)
  rootSpan = response
}

const traceWithRoot = async (message, service, rootTraceId) => {
  if (!grpcLogger) {
    grpcLogger = new DefaultEventLogger()
  }
  let traceMessage = _.cloneDeep(message)
  traceMessage.metadata.event.type = eventSDK.TraceEventTypeAction.type
  traceMessage.metadata.event.action = eventSDK.TraceEventAction.span
  let response = await grpcLogger.createSpanForMessageEnvelope(traceMessage, service, rootTraceId)
  message.metadata.trace = _.cloneDeep(traceMessage.metadata.trace)
  rootSpan = response
}

const closeSpan = async (span) => {
  if (!grpcLogger) {
    grpcLogger = new DefaultEventLogger()
  }
  return grpcLogger.logSpan(span)
}

const createChildSpan = async (message, service) => {
  if (!grpcLogger) {
    grpcLogger = new DefaultEventLogger()
  }
  let traceMessage = _.cloneDeep(message)
  traceMessage.metadata.event.type = eventSDK.TraceEventTypeAction.type
  traceMessage.metadata.event.action = eventSDK.TraceEventAction.span
  let response = await grpcLogger.createChildSpanForMessageEnvelope(traceMessage, traceMessage.metadata.trace, service, { startTimestamp: new Date().toISOString() })
  message.metadata.trace = _.cloneDeep(traceMessage.metadata.trace)
  return response
}

const closeRootSpan = async () => {
  if (rootSpan) {
    return grpcLogger.logSpan(rootSpan)
  } else {
    throw new Error('No root span found')
  }
}

module.exports = {
  closeSpan,
  trace,
  createChildSpan,
  traceWithRoot,
  closeRootSpan
}
