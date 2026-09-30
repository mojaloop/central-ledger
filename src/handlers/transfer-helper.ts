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