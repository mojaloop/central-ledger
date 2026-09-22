import { ApplicationConfig } from "../lib/config";
import { randomUUID } from "node:crypto";

const { Enum, Util } = require('@mojaloop/central-services-shared')
const { StreamingProtocol } = Util

import { Effect } from "./message-bus"

interface Dependencies {
  config: ApplicationConfig,
  randomUUID?: () => string,
}

export default class MessagingHelper {
  private config: ApplicationConfig

  constructor(private deps: Dependencies) {
    this.config = deps.config
  }

  public effectToKafkaMessage(effect: Effect) {
    const { functionality, action, message, messageKey, status, fspiopError } = effect
    const eventStatus = Enum.Events.EventStatus[status]
    const messageProtocol = StreamingProtocol.updateMessageProtocolMetadata(
      message, functionality, action, eventStatus
    )

    if (fspiopError) {
      messageProtocol.content.payload = fspiopError
    }

    // Override the metadata.event.id to something we can deterministically control in our context.
    if (messageProtocol.metadata.event.id) {
      messageProtocol.metadata.event.id = this.randomUUID()
    }

    return {
      key: messageKey,
      value: messageProtocol
    }
  }

  private randomUUID(): string {
    if (!this.deps.randomUUID) {
      return randomUUID()
    }

    return this.deps.randomUUID()
  }
}