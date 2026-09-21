
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

import assert from "assert"
import { execAsync } from "../exec-async"
import Logger from "@mojaloop/central-services-logger"
import { randomAvailablePort } from "../util"
import { DependencyOptions } from "./harness"
const logger = Logger.child({ scope: 'harness' })

interface DependencyOptionsRedis extends DependencyOptions { }

interface RedisConnectionOptions {
  port: number
}

export class Redis {
  private logger = logger.child({ scope: 'Redis' })
  private containerName: string
  private _connectionOptions: RedisConnectionOptions | null

  constructor(private options: DependencyOptionsRedis) {
    assert(options)
    assert(options.harnessId)

    this.containerName = `int_${this.options.harnessId}_redis`
    this._connectionOptions = null
  }

  public async up(): Promise<void> {
    const timerStart = performance.now()
    this.logger.debug(`up()`)
    const port = await randomAvailablePort()

    const command = `
    docker rm -f ${this.containerName} 2>/dev/null;
    docker run -d \
      --name ${this.containerName} \
      -p ${port}:6379  \
      -e ALLOW_EMPTY_PASSWORD=yes \
      --health-cmd "redis-cli ping" \
      --health-timeout 2s \
      --health-interval 10s \
      redis:latest
    `.replace(/\s/g, ' ')
    await execAsync(command)

    this.logger.info(`Redis starting at localhost:${port}`);

    this._connectionOptions = { port }
    const timerEnd = performance.now()
    this.logger.info(`up() - took: ${Math.floor(timerEnd - timerStart)}ms`)
  }

  get connectionOptions() {
    if (!this._connectionOptions) {
      throw new Error(`this._connectionOptions is null. Did you forget to call up()?`)
    }
    return this._connectionOptions
  }

  public async down(): Promise<void> {
    this.logger.debug(`down() - stopping and removing containers: ${this.containerName}.`)
    try {
      await execAsync(`docker stop ${this.containerName}`, { silent: true })
      await execAsync(`docker rm -f ${this.containerName}`, { silent: true })
      this.logger.debug(`down() - Complete.`)
    } catch (err: any) {
      this.logger.error(`down() - failed to remove containers: ${err.message}`)
      throw err
    }
  }
}
