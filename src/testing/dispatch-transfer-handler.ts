import assert from "node:assert"
import { PaymentFulfilHandler } from "../handlers/payment-fulfil"
import { PaymentPrepareHandler } from "../handlers/payment-prepare"
import { ApplicationConfig } from "../lib/config"
import { assertNestedFields } from "../lib/config/util"

/**
 * A custom TransferHandler that lets us gradually route from the legacy transfer 
 * Handler to the refactored split handlers.
 * 
 * TODO: could this live in the harness?
 */
export class DispatchTransferHandler {
  // New refactored handlers.
  private paymentPrepare: PaymentPrepareHandler
  private paymentFulfil: PaymentFulfilHandler
  private legacyTransferHandler: any

  constructor(
    private config: ApplicationConfig,
    private mode: 'LEGACY' | 'SPLIT'
  ) {
    assert(mode === 'LEGACY' || mode === 'SPLIT', '`mode` must be either LEGACY or SPLIT.')
    this.paymentPrepare = new PaymentPrepareHandler({
      config: this.config,
    })
    this.paymentFulfil = new PaymentFulfilHandler({
      config: this.config
    })

    this.legacyTransferHandler = require('../handlers/transfers/handler')
  }

  /**
   * Do async init stuff.
   */
  public async init(): Promise<void> {
    await this.legacyTransferHandler.registerPrepareHandler()
    await this.legacyTransferHandler.registerFulfilHandler()
  }

  public async prepare(error: any, message: any): Promise<any> {
    if (this.mode === 'LEGACY') {
      // Route everything to old handler. This way we can keep the tests 
      // the same.
      return this.legacyTransferHandler.prepare(error, message)
    }

    // Dispatch based on the action.
    assertNestedFields(message, 'value.metadata.event.action')
    const action = message.value.metadata.event.action as string
    switch (action) {
      case 'prepare': return this.paymentPrepare.handle(error, [message])
      case 'fx-prepare':
      case 'forwarded': 
      case 'fx-forwarded': {
        return this.legacyTransferHandler.prepare(error, message)
      }
      default: {
        // TODO: remove
        console.error(`prepare() - unhandled action: ${action}`)
        throw new Error(`prepare() - unhandled action: ${action}`)
      }
    }
  }

  public async fulfil(error: any, message: any): Promise<any> {
    if (this.mode === 'LEGACY') {
      // Route everything to old handler. This way we can keep the tests 
      // the same.
      return this.legacyTransferHandler.fulfil(error, message)
    }

    // Dispatch based on the action.
    assertNestedFields(message, 'value.metadata.event.action')
    const action = message.value.metadata.event.action as string
    switch (action) {
      case 'abort':
      case 'commit': 
      case 'reserve': {
        return this.paymentFulfil.handle(error, [message])
      }
      case 'fx-abort': 
      case 'fx-reserve': {
        return this.legacyTransferHandler.fulfil(error, message)
      }
      default: {
        // TODO: remove
        console.error(`fulfil() - unhandled action: ${action}`)
        throw new Error(`fulfil() - unhandled action: ${action}`)
      }
    }
  }
}