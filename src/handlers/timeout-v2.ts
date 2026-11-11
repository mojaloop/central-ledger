/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the 'License') and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

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

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------

 ******/

import { Effect } from "../messaging/message-bus";
import { Ledger } from "../domain/ledger/shared/types"
import { ApplicationConfig } from "../lib/config"
import { logger } from "../shared/logger";

export type TimeoutResultPayment = {
  context: any,
  effect: Effect
}
/**
 * Subset of TimedOutTransfer. Contains only what is essential to build the timeout effects.
 */
export type PaymentTimeout = {
  id: string,
  state: 'EXPIRED_PREPARED' | 'RESERVED_TIMEOUT'
  payerId: string,
  payeeId: string
}

export type TimeoutResult = {
  interval: [number, number],
  payments: Array<PaymentTimeout>
}

/**
 * @class TimeoutHandlerV2
 * @description A reimplemented timeout handler which doesn't call Kafka directly,
 *   but returns a list of effects to be emitted by the Messaging layer.
 */
export class TimeoutHandlerV2 {
  constructor(private config: ApplicationConfig, private ledger: Ledger) { }

  public async run(now: Date): Promise<TimeoutResult> {
    const resultLedger = await this.ledger.sweepTimedOut(now)
    if (resultLedger.type === 'FAILURE') {
      logger.error(`TimeoutHandlerV2.run() failed: ${resultLedger.error.message}`)
      throw resultLedger.error
    }

    return resultLedger.result
  }
}