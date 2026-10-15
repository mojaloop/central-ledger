import assert from "node:assert"

interface Dependencies {
  randomBytes: (length: number) => Buffer
}

export default class Helper {

  constructor(private deps: Dependencies) {
    assert(deps.randomBytes)

  }

  /**
   * Create a random bigint id within Number.MAX_SAFE_INTEGER (53 bits).
   * 
   * TigerBeetle Accounts can be 128 bits, but since the Admin API uses javascript/json numbers
   * to maintain backwards compatibility, we generate our own random accountIds under 
   * Number.MAX_SAFE_INTEGER to be safe.
   */
  public idSmall(): bigint {
    const bytes = this.deps.randomBytes(8)
    const value = bytes.readBigUInt64BE();
    return value & 0x1FFFFFFFFFFFFFn;
  }

}