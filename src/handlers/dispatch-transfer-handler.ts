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
import { Ledger } from '../domain/ledger/shared/types'

/**
 * A custom TransferHandler that lets us split up the different message types.
 */
export class DispatchTransferHandler {
  // New TigerBeetle-backed handlers.
  private paymentPrepare: PaymentPrepareHandler
  private paymentFulfil: PaymentFulfilHandler

  constructor(private config: ApplicationConfig, private ledger: Ledger) {   
    this.paymentPrepare = new PaymentPrepareHandler({
      config: this.config,
      ledger: this.ledger,
    })

    this.paymentFulfil = new PaymentFulfilHandler({
      config: this.config,
      ledger: this.ledger,
    })
  }

  public async prepare(error: any, messages: Array<any>):
    Promise<Array<PaymentPrepareResult>> {
    if (error) throw error
    assert(Array.isArray(messages))

    const messagesPrepare = DispatchTransferHandler.filterByAction(messages, ['prepare'])
    const messagesFxPrepare = DispatchTransferHandler.filterByAction(messages, ['fx-prepare'])
    const messagesForward = DispatchTransferHandler.filterByAction(messages, ['forwarded'])
    const messagesFxForward = DispatchTransferHandler.filterByAction(messages, ['fx-forwarded'])

    assert(messagesFxPrepare.length === 0, 'Unhandled message type `fx-prepare`.')
    assert(messagesForward.length === 0, 'Unhandled message type `forwarded`.')
    assert(messagesFxForward.length === 0, 'Unhandled message type `fx-forwarded`.')
    
    assert((messagesPrepare.length +
      messagesFxPrepare.length +
      messagesForward.length +
      messagesFxForward.length) === messages.length,
      'prepare() message buckets missing some actions.'
    )

    return await this.paymentPrepare.handle(error, messagesPrepare)
  }

  public async fulfil(error: any, messages: Array<any>): Promise<Array<PaymentFulfilResult>> {
    if (error) throw error
    assert(Array.isArray(messages))

    const messagesFulfil = DispatchTransferHandler.filterByAction(
      messages, ['abort', 'commit', 'reserve']
    )
    
    const messagesFxFulfil = DispatchTransferHandler.filterByAction(
      messages, ['fx-abort', 'fx-commit', 'fx-reserve']
    )
    assert(
      messagesFxFulfil.length === 0,
      `Unhandled message types: 'fx-abort', 'fx-commit', 'fx-reserve' .`
    )
    assert((messagesFulfil.length +
      messagesFxFulfil.length) === messages.length,
      'fulfil() message buckets missing some actions.'
    )

    return await this.paymentFulfil.handle(error, messagesFulfil)
  }

  private static filterByAction(messages: Array<any>, actions: Array<string>): Array<any> {
    return messages.filter(message => {
      assertNestedFields(message, 'value.metadata.event.action')
      return actions.indexOf(message.value.metadata.event.action) > -1
    })
  }
}
