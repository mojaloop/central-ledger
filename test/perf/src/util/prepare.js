
const positionsHandler = require('../../../../src/handlers/positions/handler').positions
const StreamingProtocol = require('@mojaloop/central-services-shared').Util.StreamingProtocol
const Enum = require('@mojaloop/central-services-shared').Enum
const EventSdk = require('@mojaloop/event-sdk')

const proceedToPosition = async (defaultKafkaConfig, params, opts) => {
  const { message, kafkaTopic, consumer, decodedPayload, span, producer } = params
  const { consumerCommit, fspiopError, eventDetail, fromSwitch, toDestination } = opts
  let metadataState

  if (fspiopError) {
    if (!message.value.content.uriParams || !message.value.content.uriParams.id) {
      message.value.content.uriParams = { id: decodedPayload.transferId }
    }
    message.value.content.payload = fspiopError
    metadataState = StreamingProtocol.createEventState(Enum.Events.EventStatus.FAILURE.status, fspiopError.errorInformation.errorCode, fspiopError.errorInformation.errorDescription)
  } else {
    metadataState = Enum.Events.EventStatus.SUCCESS
  }
  if (fromSwitch) {
    message.value.to = message.value.from
    message.value.from = Enum.Http.Headers.FSPIOP.SWITCH.value
    if (message.value.content.headers) message.value.content.headers[Enum.Http.Headers.FSPIOP.DESTINATION] = message.value.to
  }
  let key
  if (typeof toDestination === 'string') {
    message.value.to = toDestination
    if (message.value.content.headers) message.value.content.headers[Enum.Http.Headers.FSPIOP.DESTINATION] = toDestination
  } else if (toDestination === true) {
    key = message.value.content.headers && message.value.content.headers[Enum.Http.Headers.FSPIOP.DESTINATION]
  }
  if (eventDetail && producer) {
    await produceToPosition(defaultKafkaConfig, producer, eventDetail.functionality, eventDetail.action, message.value, metadataState, key, span)
  }
  return true
}

const produceToPosition = async (defaultKafkaConfig, kafkaProducer, functionality, action, message, state, key = null, span = null) => {
  let messageProtocol = StreamingProtocol.updateMessageProtocolMetadata(message, functionality, action, state)
  if (span) {
    messageProtocol = await span.injectContextToMessage(messageProtocol)
    span.audit(messageProtocol, EventSdk.AuditEventAction.egress)
  }
  await positionsHandler(null, { value: messageProtocol })
  return true
}

module.exports = {
  proceedToPosition
}
