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


/**
 * Types over javascript domain/model functions we need to inject into the new handlers.
 */

export type ProxyCache = {
  getFSPProxy: (dfspId: string, options?: unknown) => Promise<{
    inScheme: boolean,
    proxyId: string | null,
    name: string
  } | null>
}

export type CreateRemittanceEntity = () => {
  checkIfDeterminingTransferExists: (payload: any, proxyObligation: any) => Promise<any>
  getByIdLight: (id: string) => Promise<any>
  getDuplicate: (id: string) => Promise<{ [key: string]: any; hash?: string } | null>
  saveDuplicateHash: (id: string, hash: string) => Promise<void>,
  savePreparedRequest: (
    payload: unknown,
    reason: string | null,
    isValid: boolean,
    determiningTransferCheckResult: unknown,
    proxyObligation: unknown
  ) => Promise<void>,
  getPositionParticipant: (
    payload: any, 
    determiningTransferCheckResult: any,
    proxyObligation: any
  ) => Promise<any>
}

export type KafkaParams<T> = {
  message: any
  kafkaTopic: string
  decodedPayload: T
  span: any
  consumer: any
  producer: any
}
