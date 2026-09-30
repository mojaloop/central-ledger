import { ApplicationConfig } from "../lib/config";
import { Effect } from "../messaging/message-bus";
import { logger } from "../shared/logger";
import { Ledger } from "../domain/ledger/shared/types";

export type TimeoutResultPayment = {
  context: any,
  effect: Effect
}

export type TimeoutResultForex = {
  context: any,
  effect: Effect
}

export type TimeoutResultPaymentForward = {
  context: any,
  effect: Effect
}

export type TimeoutResultForexForward = {
  context: any,
  effect: Effect
}

export type TimeoutResult = {
  intervalPayment: [number, number],
  intervalForex: [number, number],
  results: Array<
    TimeoutResultPayment |
    TimeoutResultForex |
    TimeoutResultPaymentForward |
    TimeoutResultForexForward
  >
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