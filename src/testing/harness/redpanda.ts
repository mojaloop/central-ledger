
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

export interface RedpandaConnectionOptions {
  port: number
}

/**
 * Starts a redpanda and redpanda console docker container.
 * Redpanda is much quicker to start up than Kafka, so is more suitable for this testing harness.
 */
export class Redpanda {
  private logger = logger.child({ scope: 'Redpanda' })
  private options: DependencyOptions
  private containerName: string
  private containerNameConsole: string
  private _connectionOptions: null | RedpandaConnectionOptions

  /**
   * The topics to create when spinning up the container.
   */
  private topics = [
    'topic-transfer-prepare',
    'topic-transfer-position',
    'topic-transfer-fulfil',
    'topic-notification-event',
    'topic-admin-transfer',
    'topic-transfer-position-batch',
    'topic-bulk-prepare',
    'topic-bulk-get',
    'topic-bulk-fulfil',
    'topic-bulk-processing',
  ]

  constructor(options: DependencyOptions) {
    assert(options)
    assert(options.harnessId)

    this.options = options;
    this.containerName = `int_${this.options.harnessId}_redpanda`
    this.containerNameConsole = `int_${this.options.harnessId}_redpanda_console`
    this._connectionOptions = null
  }

  public async up(): Promise<void> {
    const timerStart = performance.now()
    this.logger.debug(`up()`)
    const portRedpanda = await randomAvailablePort()
    const portConsole = await randomAvailablePort()

    const command = `
    docker rm -f ${this.containerName} ${this.containerNameConsole} 2>/dev/null;
    docker network create harness || echo 'harness exists';
    docker run -d \
      --name ${this.containerName} \
      --network harness \
      -p ${portRedpanda}:9092 \
      --health-cmd="rpk cluster info" \
      --health-interval=100ms \
      --health-timeout=500ms \
      --health-retries=100 \
      --health-start-period=0s \
      docker.io/redpandadata/redpanda:latest \
      redpanda start \
      --mode dev-container \
      --smp 1 \
      --memory 400M \
      --reserve-memory 0M \
      --overprovisioned \
      --node-id 0 \
      --check=false \
      --kafka-addr internal://0.0.0.0:29092,external://0.0.0.0:9092 \
      --advertise-kafka-addr internal://${this.containerName}:29092,external://localhost:${portRedpanda}
    `.replace(/\s+/g, ' ')
    const { stdout, stderr } = await execAsync(command)
    this.logger.info(`Redpanda.up() stdout: ${stdout}`)
    this.logger.info(`Redpanda.up() stderr: ${stderr}`)

    const commandConsole = `
    docker run -d \
      --name ${this.containerNameConsole} \
      --hostname ${this.containerNameConsole} \
      --restart on-failure \
      --network harness \
      -p ${portConsole}:8080 \
      -e KAFKA_BROKERS=${this.containerName}:29092 \
      docker.redpanda.com/redpandadata/console:latest
    `.replace(/\s+/g, ' ')

    await execAsync(commandConsole)

    this._connectionOptions = {
      port: portRedpanda,
    }

    this.logger.warn(`Redpanda - go to: http://localhost:${portConsole} to see the Redpanda Console`);
    await this.waitForHealthy()
    await this.createTopics()
    const timerEnd = performance.now()
    this.logger.info(`up() - took: ${Math.floor(timerEnd - timerStart)}ms`)
  }

  private async waitForHealthy(): Promise<void> {
    assert(this._connectionOptions)

    let attemptsMax = 75
    let delayMs = 50

    for (let attempt = 1; attempt <= attemptsMax; attempt++) {
      try {
        const command = `docker inspect --format='{{.State.Health.Status}}' ${this.containerName}`
        const { stdout } = await execAsync(command, { silent: true })

        if (stdout.trim() !== 'healthy') {
          throw new Error('Not ready.')
        }

        logger.info(`Redpanda started after ${attempt} attempts (${attempt * delayMs}ms).`)
        return
      } catch (err: any) {
        if (attempt === attemptsMax) {
          throw new Error(`Redpanda failed to start after ${attemptsMax} attempts.\n${err.message}`)
        }

        logger.debug(`Waiting for Redpanda: [attempt ${`${attempt}`.padStart(3)}/${attemptsMax}]`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  private async createTopics(): Promise<void> {
    logger.debug(`createTopics() - creating ${this.topics.length} kafka topics`);

    const commands = this.topics.map(topic =>
      `docker exec ${this.containerName} rpk topic create ${topic}`
    );

    await Promise.all(commands.map(async cmd => {
      await execAsync(cmd, { silent: true, force: true })
    }))
  }

  get connectionOptions(): RedpandaConnectionOptions {
    if (!this._connectionOptions) {
      throw new Error(`this._connectionOptions is null. Did you forget to call up()?`)
    }
    return this._connectionOptions
  }

  public async down(): Promise<void> {
    this.logger.debug(`down() - stopping and removing containers: ${this.containerName}, ${this.containerNameConsole}.`)
    try {
      await execAsync(`docker stop ${this.containerName} ${this.containerNameConsole}`, { silent: true })
      await execAsync(`docker rm -f ${this.containerName} ${this.containerNameConsole}`, { silent: true })
      this.logger.debug(`down() - Complete.`)
    } catch (err: any) {
      this.logger.error(`down() - failed to remove containers: ${err.message}`)
      throw err
    }
  }

  /**
   * Get the sum of all watermarks across all topics.
   */
  public async mark(): Promise<number> {
    let watermarkSum = 0
    for (const topic of this.topics) {
      const cmd = `docker exec ${this.containerName} rpk topic describe ${topic} --format=json`
      const { stdout } = await execAsync(cmd)

      const describeJson = JSON.parse(stdout)[0].partitions[0]
      watermarkSum += describeJson.high_watermark
    }
    return watermarkSum;
  }
}
