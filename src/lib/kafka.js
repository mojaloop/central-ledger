const Enum = require('@mojaloop/central-services-shared').Enum
const StreamingProtocol = require('@mojaloop/central-services-shared').Util.StreamingProtocol
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka

const proceed = async (defaultKafkaConfig, params, opts) => {
  const { message, kafkaTopic, consumer, decodedPayload, span, producer } = params
  const { consumerCommit, fspiopError, eventDetail, fromSwitch, messageKey } = opts
  let metadataState

  if (consumerCommit) {
    await Kafka.commitMessageSync(consumer, kafkaTopic, message)
  }
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

  if (eventDetail && producer) {
    await Kafka.produceGeneralMessage(defaultKafkaConfig, producer, eventDetail.functionality, eventDetail.action, message.value, metadataState, messageKey?.toString(), span)
  }
  return true
}

module.exports = {
  proceed
}
