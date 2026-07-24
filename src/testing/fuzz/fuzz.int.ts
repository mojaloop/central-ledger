import { describe, it } from "node:test";
import LedgerFuzzer from ".";
import { Snapshot } from "../snapshot";

describe('LedgerFuzz', () => {

  it('fuzz', async () => {
    const fuzzer = new LedgerFuzzer({
      seed: process.env.SEED ? parseInt(process.env.SEED) : 1111,
      steps: 5
    })

    const result = await fuzzer.run()
    Snapshot.from(`{
      "tag": "PASS"
    }`).checkUnwrap(result)
  })
})