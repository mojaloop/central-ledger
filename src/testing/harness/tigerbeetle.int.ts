/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
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

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------

 ******/

import { describe, it } from "node:test";
import { createClient, id } from "tigerbeetle-node";
import { TigerBeetle } from "./tigerbeetle";

describe('harness/tigerbeetle', () => {
  it('downloads and starts TigerBeetle', async () => {
    const tb = new TigerBeetle({
      id: 11,
      pathToBinary: `.tigerbeetle/tigerbeetle`,
      dataDirs: [`/Volumes/RAMDisk/`, './tigerbeetle'],
      version: '0.17.9'
    })

    await tb.up()
    const client = createClient({
      cluster_id: 0n,
      replica_addresses: [tb.connectionOptions.port]
    })
    const account = {
      id: id(),
      debits_pending: 0n,
      debits_posted: 0n,
      credits_pending: 0n,
      credits_posted: 0n,
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      reserved: 0,
      ledger: 1,
      code: 718,
      flags: 0,
      timestamp: 0n,
    };
    const account_results = await client.createAccounts([account]);
    console.log('account_results', account_results)

    client.destroy()
    await tb.down()
  })
})