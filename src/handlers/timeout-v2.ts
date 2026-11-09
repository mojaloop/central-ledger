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
  intervalPayment: [number, number],
  intervalForex: [number, number],
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