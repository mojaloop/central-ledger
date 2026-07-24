import Logger from "@mojaloop/central-services-logger"
const logger = Logger.child({context: 'LedgerFuzzer'})
export type Action = ActionDFSP


export enum ActionDFSP {
  /**
   * Do nothing
   */
  NONE = 'NONE',

  /**
   * Create a Transfer that is considered valid by the switch and should be accepted by the
   * counterparty
   */
  PREPARE_PAYMENT_VALID = 'PREPARE_PAYMENT_VALID',

  /**
   * Create a Transfer that is considered invalid by the switch.
   */
  PREPARE_PAYMENT_INVALID = 'PREPARE_PAYMENT_INVALID',

  /**
   * Create a Transfer that is an exact duplicate of a previous transfer.
   */
  PREPARE_PAYMENT_DUPLICATE = 'PREPARE_PAYMENT_DUPLICATE',

  /**
   * Create a unique transfer body, with a reused transferId
   */
  PREPARE_PAYMENT_REUSE_ID = 'PREPARE_PAYMENT_REUSE_ID',

  /**
   * Create a transfer that will exceed the dfsp's net debit cap
   */
  PREPARE_PAYMENT_OVER_LIMIT = 'PREPARE_PAYMENT_OVER_LIMIT',

  /**
   * Get a transfer that this DFSP already created
   */
  GET_TRANSFER_EXISTING = 'GET_TRANSFER_EXISTING',

  /**
   * Try to get a transfer for a random id that hasn't been created
   */
  GET_TRANSFER_NOT_EXISTING = 'GET_TRANSFER_NOT_EXISTING',

  /**
   * Look up an existing transaction
   */
  GET_TRANSACTION_EXISTING = 'GET_TRANSACTION_EXISTING',

  /**
   * Change the net debit cap of a DFSP
   */
  CHANGE_NET_DEBIT_CAP = 'CHANGE_NET_DEBIT_CAP',

  /**
   * Respond to a `PREPARE_PAYMENT_VALID` by accepting the transfer
   * and don't expect a callback from the switch
   */
  FULFIL_PAYMENT_COMMITTED = 'FULFIL_PAYMENT_COMMITTED',

  /**
   * Respond to a `PREPARE_PAYMENT_VALID` by accepting the transfer
   * and but ask the switch to send the callback upon committing
   */
  FULFIL_PAYMENT_RESERVED = 'FULFIL_PAYMENT_RESERVED',

  /**
   * Don't respond to the inbound message at all.
   */
  IGNORE = 'IGNORE',

  /**
   * The DFSP aborts the Transfer. Could also be the non-payee dfsp.
   */
  ABORT_PAYMENT = 'ABORT_PAYMENT',
}

/**
 * Change the probability of different actions.
 */
export const ActionWeights: Record<Action, number> = {
  [ActionDFSP.NONE]: 0,
  [ActionDFSP.PREPARE_PAYMENT_VALID]: 20,
  [ActionDFSP.PREPARE_PAYMENT_INVALID]: 5,
  [ActionDFSP.PREPARE_PAYMENT_DUPLICATE]: 2,
  [ActionDFSP.PREPARE_PAYMENT_REUSE_ID]: 0,
  [ActionDFSP.PREPARE_PAYMENT_OVER_LIMIT]: 0,
  [ActionDFSP.GET_TRANSFER_EXISTING]: 1,
  [ActionDFSP.GET_TRANSFER_NOT_EXISTING]: 0,
  [ActionDFSP.GET_TRANSACTION_EXISTING]: 0,
  [ActionDFSP.CHANGE_NET_DEBIT_CAP]: 0,
  [ActionDFSP.FULFIL_PAYMENT_COMMITTED]: 0,
  [ActionDFSP.FULFIL_PAYMENT_RESERVED]: 0,
  [ActionDFSP.IGNORE]: 2,
  [ActionDFSP.ABORT_PAYMENT]: 0,
}

export class Doer {

  public async do(action: Action): Promise<void> {
    switch (action) {
      case ActionDFSP.PREPARE_PAYMENT_VALID: return this.preparePaymentValid()
      case ActionDFSP.PREPARE_PAYMENT_INVALID:
      case ActionDFSP.PREPARE_PAYMENT_DUPLICATE:
      case ActionDFSP.PREPARE_PAYMENT_REUSE_ID:
      case ActionDFSP.PREPARE_PAYMENT_OVER_LIMIT:
      case ActionDFSP.GET_TRANSFER_EXISTING:
      case ActionDFSP.GET_TRANSFER_NOT_EXISTING:
      case ActionDFSP.GET_TRANSACTION_EXISTING:
      case ActionDFSP.CHANGE_NET_DEBIT_CAP:
      case ActionDFSP.FULFIL_PAYMENT_COMMITTED:
      case ActionDFSP.FULFIL_PAYMENT_RESERVED:
      case ActionDFSP.IGNORE:
      case ActionDFSP.ABORT_PAYMENT:
        logger.warn(`Doer.do() action not implemented: ${action}.`)
        return
      case ActionDFSP.NONE:
        return
    }
  }

  private async preparePaymentValid(): Promise<void> {
    // ledger.prepare();
    
  }
}