import { describe, it } from "node:test";
import { TigerBeetle } from "./tigerbeetle";
import { createClient, id } from "tigerbeetle-node";

describe('harness/tigerbeetle', () => {
  it('downloads and starts TigerBeetle', async () => {
    const tb = new TigerBeetle({
      harnessId: 21,
      pathToBinary: `.tigerbeetle/tigerbeetle`,
      dataDir: `/Volumes/RAMDisk/`,
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