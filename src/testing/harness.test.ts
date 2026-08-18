import { describe, it } from "node:test";
import Harness from "./harness";

const harness = Harness.getInstance()

/**
 * Use this test to verify that the harness is working as expected.
 * node --test --require ts-node/register src/testing/harness.test.ts
 */
describe('harness smoke test', () => {
  it('up() and down()', async () => {
    await harness.up()
    await harness.down()
  })
})