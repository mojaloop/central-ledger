import { Enum } from '@mojaloop/central-services-shared'

export interface WrapMessageParams {
  message: any
  kafkaTopic: string
  decodedPayload?: any
}

export interface WrapMessageOpts {
  fspiopError?: {
    errorInformation: {
      errorCode: string
      errorDescription: string
    }
  }
  eventDetail: {
    functionality: string
    action: string
  }
  messageKey: string
  fromSwitch?: boolean
  toDestination?: string
  hubName?: string
}

/**
 * A collection of utilities to make refactoring easier. We should expect these to go the way of the
 * dinosaurs when the TigerBeetle integration is complete.
 */
export default class RefactorHelper {

  /**
   * @function wrapForPositionHandler
   * @description Copies what `Kafka.proceed()` does internally and wraps a given message so that
   *   we can directly call the batch handler. Used when `TRANSFER_POSITION_FUSE` = 'FUSE'.
   */
  public static wrapForPositionHandler(params: WrapMessageParams, opts: WrapMessageOpts): any {
    const { message, kafkaTopic, decodedPayload } = params
    const { fspiopError, eventDetail, messageKey, fromSwitch, toDestination, hubName } = opts

    const wrappedValue = JSON.parse(JSON.stringify(message.value))

    // Error case.
    let metadataState: any
    if (fspiopError) {
      if (!wrappedValue.content.uriParams || !wrappedValue.content.uriParams.id) {
        wrappedValue.content.uriParams = { id: decodedPayload?.transferId }
      }
      wrappedValue.content.payload = fspiopError
      metadataState = {
        status: 'error',
        code: fspiopError.errorInformation.errorCode,
        description: fspiopError.errorInformation.errorDescription
      }
    } else {
      metadataState = {
        status: 'success',
        code: 0,
        description: 'action successful'
      }
    }

    if (fromSwitch) {
      wrappedValue.to = wrappedValue.from
      wrappedValue.from = hubName
      if (wrappedValue.content.headers) {
        wrappedValue.content.headers[Enum.Http.Headers.FSPIOP.SOURCE] = wrappedValue.from
        wrappedValue.content.headers[Enum.Http.Headers.FSPIOP.DESTINATION] = wrappedValue.to
      }
    }

    if (typeof toDestination === 'string') {
      wrappedValue.to = toDestination
      if (wrappedValue.content.headers) {
        wrappedValue.content.headers[Enum.Http.Headers.FSPIOP.DESTINATION] = toDestination
      }
    }

    // Update metadata
    if (!wrappedValue.metadata) {
      wrappedValue.metadata = {
        event: {
          id: crypto.randomUUID(),
          type: eventDetail.functionality,
          action: eventDetail.action,
          state: metadataState
        }
      }
    } else {
      wrappedValue.metadata.event = {
        ...wrappedValue.metadata.event,
        responseTo: wrappedValue.metadata.event.id,
        id: crypto.randomUUID(),
        type: eventDetail.functionality,
        action: eventDetail.action,
        state: metadataState
      }
    }

    return {
      ...message,
      key: messageKey,
      offset: 0,
      partition: 0,
      topic: kafkaTopic,
      value: wrappedValue
    }
  }
}