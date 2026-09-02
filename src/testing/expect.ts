import { ApplicationConfig } from "../lib/config";
import Harness from "./harness";
import { Snapshot } from "./snapshot";

/**
 * Resuable, customizable test expectations.
 */
export default class Expect {
  public constructor(private config: ApplicationConfig, private harness: Harness) {

  }

  public topicsPaymentPrepareOrFulfil(): void {
    switch (this.config.HANDLERS_TRANSFER_POSITION_FUSE) {
      case "UNFUSE": {
        const topics = this.harness.spoolLastTopic(2)
        Snapshot.from(`[
          "topic-transfer-pos:ignore",
          "topic-notification-event"
        ]`).checkUnwrap(topics)
      }
      case "FUSE": {
        const topics = this.harness.spoolLastTopic(1)
        Snapshot.from(`[
          "topic-notification-event"
        ]`).checkUnwrap(topics)
      }
    }
  }

  public messagesPayment(): number {
    switch (this.config.HANDLERS_TRANSFER_POSITION_FUSE) {
      case "UNFUSE": return 2
      case "FUSE": return 1
    }
  }

  public messagesForex(): number {
    switch (this.config.HANDLERS_TRANSFER_POSITION_FUSE) {
      case "UNFUSE": return 2
      case "FUSE": return 1
    }
  }

  public messagesPaymentTimeout(): number {
    switch (this.config.HANDLERS_TRANSFER_POSITION_FUSE) {
      case "UNFUSE": return 2
      case "FUSE": return 1
    }
  }

   public messagesForexTimeout(): number {
    switch (this.config.HANDLERS_TRANSFER_POSITION_FUSE) {
      case "UNFUSE": return 2
      case "FUSE": return 1
    }
  }

}