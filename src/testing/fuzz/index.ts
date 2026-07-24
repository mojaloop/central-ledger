import Logger from "@mojaloop/central-services-logger"
import PRNG from "../prng"
import { Action, ActionWeights, Doer } from "./action"
const logger = Logger.child({context: 'LedgerFuzzer'})

export interface LedgerFuzzerOptions {
  seed: number
  steps: number
}

export type Result = {
  tag: 'PASS'
} | {
  tag: 'FAIL',
  failures: Array<unknown>,
}

export default class LedgerFuzzer {
  private _step = 0
  private prng: PRNG
  private choiceTable: Array<Action>
  private doer: Doer

  constructor(private options: LedgerFuzzerOptions) {
    logger.debug(`creating LedgerFuzzer with options: ${options}`)

    this.prng = new PRNG(options.seed)
    this.choiceTable = PRNG.generateWeightedChoiceTable(ActionWeights)
    this.doer = new Doer()
  }

  public async run(): Promise<Result> {
    while (this._step <= this.options.steps) {
      await this.step()

      // TODO: validate we didn't die!
      // Check DSFP positions.
      // Check messages injested and emitted.
      this._step += 1
    }

    return {
      tag: 'PASS'
    }
  }

  /**
   * In each step, we call a method on the Ledger.
   */
  private async step(): Promise<void> {
    logger.debug(`step() - ${this._step}`)
    const action = this.pickAction()
    logger.debug(`\t${action}`)
    this.doer.do(action)
  }

  // Eventually we can introduce a strategy into this to make it smarter!
  // For now, random is fine.
  private pickAction(): Action {
    return this.prng.randomElementFrom(this.choiceTable)
  }
}
