import assert from 'node:assert'
import crypto from 'node:crypto'
const ErrorHandler = require('@mojaloop/central-services-error-handling')

/**
 * Common functions we need across all payment-* and forex-* handlers.
 */
export class TransferHelper {
  
  public static fulfilmentMatchesCondition(fulfilment: string, condition: string): boolean {
    try {
      const derivedCondition = this.fulfilmentToCondition(fulfilment)
      return derivedCondition === condition
    } catch (err) {
      return false
    }
  }

  public static fulfilmentToCondition(fulfilment: string) {
    const hashSha256 = crypto.createHash('sha256')
    const preimage = Buffer.from(fulfilment, 'base64url')

    if (preimage.length !== 32) {
      throw ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR,
        'Interledger preimages must be exactly 32 bytes'
      )
    }
    return hashSha256.update(preimage).digest('base64url').toString()
  }

  public static hashPayload(payload: any) {
    const cryptoHash = crypto.createHash('sha256')
    cryptoHash.update(JSON.stringify(payload))
    const hash = cryptoHash.digest('base64url')
    assert(hash.at(-1) !== '=', 'Hash should not have trailing `=`.')

    return hash
  }
}