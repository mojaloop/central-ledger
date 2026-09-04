/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------
 ******/

import assert from 'node:assert'
import { ApplicationConfig } from '../lib/config'
import { assertNestedFields } from '../lib/config/util'
import { PaymentPrepareHandler, PaymentPrepareResult } from './payment-prepare'
import { PaymentFulfilHandler, PaymentFulfilResult } from './payment-fulfil'
import { ForexPrepareHandler, ForexPrepareResult } from './forex-prepare'
import { ForexFulfilHandler, ForexFulfilResult } from './forex-fulfil'
import { PaymentForwardHandler, PaymentForwardResult } from './payment-forward'
import { ForexForwardHandler, ForexForwardResult } from './forex-forward'
import { PositionHandlerV2 } from './position-v2'

const { Util } = require('@mojaloop/central-services-shared')
const { Kafka } = Util
const { Consumer } = require('@mojaloop/central-services-stream').Util

/**
 * A custom TransferHandler that lets us gradually route from the legacy transfer
 * handlers to the refactored split handlers.
 */
export class DispatchTransferHandler {
  // New refactored handlers.
  private paymentPrepare: PaymentPrepareHandler
  private paymentFulfil: PaymentFulfilHandler
  private paymentForward: PaymentForwardHandler
  private forexPrepare: ForexPrepareHandler
  private forexFulfil: ForexFulfilHandler
  private forexForward: ForexForwardHandler
  private positionHandler: PositionHandlerV2

  private legacyTransferHandler: any

  private mode: 'JOINED' | 'SPLIT'

  constructor(
    private config: ApplicationConfig,
  ) {
    this.mode = this.config.HANDLERS_TRANSFER_DISPATCH_MODE
    assert(this.mode === 'JOINED' || this.mode === 'SPLIT', '`mode` must be LEGACY or SPLIT.')

    // let positionHandler = null
    // if (config.HANDLERS_TRANSFER_POSITION_FUSE === 'FUSE') {
      // positionHandler = require('./positions/handlerBatch').positions
    // }

    // These are global imports, and MUST be imported after we've overriden the config.
    const proxyCache = require('../lib/proxyCache')
    const {
      createRemittanceEntityPayment,
      createRemittanceEntityForex,
    } = require('../handlers/transfers/createRemittanceEntity')
    const {
      definePositionParticipant,
    } = require('../handlers/transfers/prepare')
    this.positionHandler = new PositionHandlerV2(this.config)
    this.paymentPrepare = new PaymentPrepareHandler({
      config: this.config,
      proxyCache,
      createRemittanceEntity: createRemittanceEntityPayment,
      definePositionParticipant,
      positionHandler: this.positionHandler,
    })

    const fxService = require('../domain/fx')
    this.paymentFulfil = new PaymentFulfilHandler({
      config: this.config,
      fxService,
      positionHandler: this.positionHandler,
    })
    this.paymentForward = new PaymentForwardHandler({ config: this.config })
    this.forexPrepare = new ForexPrepareHandler({
      config: this.config,
      proxyCache,
      createRemittanceEntity: createRemittanceEntityForex,
      positionHandler: this.positionHandler
    })
    const cyril = require('../domain/fx/cyril')
    this.forexFulfil = new ForexFulfilHandler({
      config: this.config,
      cyril,
      positionHandler: this.positionHandler
    })
    this.forexForward = new ForexForwardHandler({ config: this.config })

    this.legacyTransferHandler = require('../handlers/transfers/handler')
  }

  /**
   * @deprecated Replaced by MessageBus.init()
   * Do async init stuff.
   *
   * Register the prepare and fulfil kafka consumers. In test we need this to be able to commit the
   * offsets, but when running properly, this registers the handlers. Eventually this will be
   * refactored so that the dispatch handler has no notion of kafka at all, but instead kafka will
   * be handled at a messaging layer.
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

  public async prepare(error: any, messageOrMessages: any | Array<any>):
    Promise<Array<
      PaymentPrepareResult | PaymentForwardResult | ForexPrepareResult | ForexForwardResult
    >> {
    if (this.mode === 'JOINED') {
      // Route everything to old handler. This way we can keep the tests the same.
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
    const messagesForward = DispatchTransferHandler.filterByAction(messages, ['forwarded'])
    const messagesFxForward = DispatchTransferHandler.filterByAction(messages, ['fx-forwarded'])

    assert((messagesPrepare.length +
      messagesFxPrepare.length +
      messagesForward.length +
      messagesFxForward.length) === messages.length,
      'prepare() message buckets missing some actions.'
    )

    const resultsPrepare = await this.paymentPrepare.handle(error, messagesPrepare)
    const resultsFxPrepare = await this.forexPrepare.handle(error, messagesFxPrepare)
    const resultsForward = await this.paymentForward.handle(error, messagesForward)
    const resultsFxForward = await this.forexForward.handle(error, messagesFxForward)

    return [
      ...resultsPrepare,
      ...resultsForward,
      ...resultsFxPrepare,
      ...resultsFxForward,
    ]
  }

  // TODO: I feel like we are missing fx-forwarded on the fulfil path somehow. We probably don't
  // have tests for this.
  public async fulfil(error: any, messageOrMessages: any | Array<any>):
    Promise<Array<PaymentFulfilResult | ForexFulfilResult>> {
    if (this.mode === 'JOINED') {
      // Route everything to old handler. This way we can keep the tests the same.
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
