import assert from "node:assert"
import { ApplicationConfig } from "../lib/config"
import { assertNestedFields } from "../lib/config/util"
import { PaymentPrepareHandler } from "./payment-prepare"
import { PaymentFulfilHandler } from "./payment-fulfil"
import { ForexPrepareHandler } from "./forex-prepare"
import { ForexFulfilHandler } from "./forex-fulfil"

const { Util } = require('@mojaloop/central-services-shared')
const { Kafka } = Util
const { Consumer } = require('@mojaloop/central-services-stream').Util

/**
 * A custom TransferHandler that lets us gradually route from the legacy transfer 
 * Handler to the refactored split handlers.
 */
export class DispatchTransferHandler {
  // New refactored handlers.
  private paymentPrepare: PaymentPrepareHandler
  private paymentFulfil: PaymentFulfilHandler
  private forexPrepare: ForexPrepareHandler
  private forexFulfil: ForexFulfilHandler
  private legacyTransferHandler: any

  private mode: 'JOINED' | 'SPLIT'

  constructor(
    private config: ApplicationConfig,
  ) {
    this.mode = this.config.HANDLERS_TRANSFER_DISPATCH_MODE
    assert(this.mode === 'JOINED' || this.mode === 'SPLIT', '`mode` must be LEGACY or SPLIT.')

    // These are global imports, and MUST be imported after we've overriden the config.
    const proxyCache = require('../lib/proxyCache')
    const {
      createRemittanceEntityPayment,
      createRemittanceEntityForex
    } = require("../handlers/transfers/createRemittanceEntity")
    const { sendPositionPrepareMessage } = require('../handlers/transfers/prepare')
    this.paymentPrepare = new PaymentPrepareHandler({
      config: this.config,
      proxyCache,
      createRemittanceEntity: createRemittanceEntityPayment,
      sendPositionPrepareMessage
    })

    const fxService = require('../domain/fx')
    this.paymentFulfil = new PaymentFulfilHandler({
      config: this.config,
      fxService,
    })
    this.forexPrepare = new ForexPrepareHandler({
      config: this.config,
      proxyCache,
      createRemittanceEntity: createRemittanceEntityForex
    })
    const cyril = require('../domain/fx/cyril')
    this.forexFulfil = new ForexFulfilHandler({
      config: this.config,
      cyril
    })

    this.legacyTransferHandler = require('../handlers/transfers/handler')
  }

  /**
   * Do async init stuff.
   * 
   * Register the prepare and fulfil kafka consumers. In test we need this to be able to commit the
   * offsets, but when running properly, this registers the handlers. Eventually this will be
   * refactored so that the dispatch handler has no notion of kafka at all, but instead kafaka will
   * handled at a messaging layer.
   */
  public async init(): Promise<void> {
    // Register the consumers in globals.
    const topicConsumePrepare = 'topic-transfer-prepare'
    const topicConsumeFulfil = 'topic-transfer-fulfil'
    const configConsumePrepare = Kafka.getKafkaConfig(
      this.config.KAFKA_CONFIG,
      'CONSUMER',
      'TRANSFER',
      'PREPARE'
    )
    const configConsumeFulfil = Kafka.getKafkaConfig(
      this.config.KAFKA_CONFIG,
      'CONSUMER',
      'TRANSFER',
      'FULFIL'
    )
    configConsumePrepare.rdkafkaConf['client.id'] = topicConsumePrepare
    configConsumeFulfil.rdkafkaConf['client.id'] = topicConsumeFulfil

    await Consumer.createHandler(topicConsumePrepare, configConsumePrepare, this.prepare.bind(this))
    await Consumer.createHandler(topicConsumeFulfil, configConsumeFulfil, this.fulfil.bind(this))
  }

  public async prepare(error: any, messageOrMessages: any | Array<any>): Promise<any> {
    if (this.mode === 'JOINED') {
      // Route everything to old handler. This way we can keep the tests 
      // the same.
      return this.legacyTransferHandler.prepare(error, messageOrMessages)
    }

    let messages: Array<any>
    if (Array.isArray(messageOrMessages)) {
      messages = messageOrMessages
    } else {
      messages = [messageOrMessages]
    }

    const messagesPrepare = DispatchTransferHandler.filterByAction(messages, ['prepare'])
    const messagesFxPrepare = DispatchTransferHandler.filterByAction(messages, ['fx-prepare'])
    const messagesForwared = DispatchTransferHandler.filterByAction(messages, ['forwarded'])
    const messagesFxForwared = DispatchTransferHandler.filterByAction(messages, ['fx-forwarded'])

    assert((messagesPrepare.length +
      messagesFxPrepare.length +
      messagesForwared.length +
      messagesFxForwared.length) === messages.length,
      'prepare() message buckets missing some actions.'
    )

    const resultsPrepare = await this.paymentPrepare.handle(error, messagesPrepare)
    const resultsFxPrepare = await this.forexPrepare.handle(error, messagesFxPrepare)
    let resultsForwarded = []
    if (messagesForwared.length > 0) {
      resultsForwarded = await this.legacyTransferHandler.prepare(error, messagesForwared)
    }
    let resultsFxForwarded = []
    if (messagesFxForwared.length > 0) {
      resultsFxForwarded = await this.legacyTransferHandler.prepare(error, messagesFxForwared)
    }

    return [
      ...resultsPrepare,
      ...resultsFxPrepare,
      ...resultsForwarded,
      ...resultsFxForwarded,
    ]
  }

  // TODO: I feel like we are missing fx-forwarded on the fulfil path somehow. Probably don't have
  // tests for this.
  public async fulfil(error: any, messageOrMessages: any | Array<any>): Promise<any> {
    if (this.mode === 'JOINED') {
      // Route everything to old handler. This way we can keep the tests 
      // the same.
      return this.legacyTransferHandler.fulfil(error, messageOrMessages)
    }

    let messages: Array<any>
    if (Array.isArray(messageOrMessages)) {
      messages = messageOrMessages
    } else {
      messages = [messageOrMessages]
    }

    const messagesFulfil = DispatchTransferHandler.filterByAction(
      messages, ['abort', 'commit', 'reserve']
    )
    const messagesFxFulfil = DispatchTransferHandler.filterByAction(
      messages, ['fx-abort', 'fx-commit', 'fx-reserve']
    )
    assert((messagesFulfil.length +
      messagesFxFulfil.length) === messages.length,
      'fulfil() message buckets missing some actions.'
    )

    const resultsFulfil = await this.paymentFulfil.handle(error, messagesFulfil)
    const resultsFxFulfil = await this.forexFulfil.handle(error, messagesFxFulfil)

    return [
      ...resultsFulfil, ...resultsFxFulfil
    ]
  }

  private static filterByAction(messages: Array<any>, actions: Array<string>): Array<any> {
    return messages.filter(message => {
      assertNestedFields(message, 'value.metadata.event.action')
      return actions.indexOf(message.value.metadata.event.action) > -1
    })
  }
}