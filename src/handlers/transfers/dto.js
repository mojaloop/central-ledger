const { Util, Enum } = require('@mojaloop/central-services-shared')
const { PROM_METRICS } = require('../../shared/constants')

const { decodePayload } = Util.StreamingProtocol
const { Action, Type } = Enum.Events.Event

const prepareInputDto = (error, messages) => {
  if (error || !messages) {
    return {
      error,
      metric: PROM_METRICS.transferPrepare()
    }
  }

  const message = Array.isArray(messages) ? messages[0] : messages
  if (!message) throw new Error('No input kafka message')

  const payload = decodePayload(message.value.content.payload)
  const isForwarded = message.value.metadata.event.action === Action.FORWARDED
  const isFx = !payload.transferId && !isForwarded

  const { action } = message.value.metadata.event
  const isPrepare = [Action.PREPARE, Action.FX_PREPARE, Action.FORWARDED].includes(action)

  const actionLetter = isPrepare
    ? Enum.Events.ActionLetter.prepare
    : (action === Action.BULK_PREPARE
        ? Enum.Events.ActionLetter.bulkPrepare
        : Enum.Events.ActionLetter.unknown)

  const functionality = isPrepare
    ? Type.NOTIFICATION
    : (action === Action.BULK_PREPARE
        ? Type.BULK_PROCESSING
        : Enum.Events.ActionLetter.unknown)

  return {
    message,
    payload,
    action,
    functionality,
    isFx,
    isForwarded,
    ID: payload.transferId || payload.commitRequestId || message.value.id,
    headers: message.value.content.headers,
    metric: PROM_METRICS.transferPrepare(isFx, isForwarded),
    actionLetter // just for logging
  }
}

module.exports = {
  prepareInputDto
}
