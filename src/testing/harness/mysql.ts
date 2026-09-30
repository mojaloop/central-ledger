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
import knex from 'knex'
import { randomAvailablePort } from "../util"
import { Clock } from "../mock-clock"
import { DependencyOptions } from "./harness"
const logger = Logger.child({ scope: 'harness' })

interface DependencyOptionsMySql extends DependencyOptions {
  databaseName: string,
  migration: MigrationOptions,
  clock: Clock
}

interface MigrationOptionsKnex {
  type: 'knex';

  /**
   * If this is set, then after running the knex migration, perform a mysql dump
   * to update the migration file
   */
  updateSqlFilePath?: string
}

interface MigrationOptionsSql {
  type: 'sql';
  sqlFilePath: string;
}

type MigrationOptions = MigrationOptionsKnex | MigrationOptionsSql;

export interface ConnectionOptionsMySql {
  port: number
}

export class MySql {
  private logger = logger.child({ scope: 'MySql' })
  private options: DependencyOptionsMySql
  private containerName: string
  private _connectionOptions: ConnectionOptionsMySql | null
  private clock: Clock

  constructor(options: DependencyOptionsMySql) {
    assert(options)
    assert(options.harnessId)

    this.options = options;
    this.containerName = `int_${this.options.harnessId}_mysql`
    this._connectionOptions = null
    this.clock = options.clock
  }

  public async up(): Promise<void> {
    const timerStart = performance.now()
    this.logger.debug(`up()`)
    const port = await randomAvailablePort()

    // Highly optimzed `docker run` to try and improve startup time.
    // takes around 3500 ms on my Mac.
    const command = `
    docker rm -f ${this.containerName} 2>/dev/null;
    docker run -d \
      --name ${this.containerName} \
      --tmpfs /var/lib/mysql:rw,size=256m \
      -e MARIADB_ROOT_PASSWORD=password \
      -e MARIADB_DATABASE=${this.options.databaseName} \
      -p ${port}:3306 \
      --health-cmd="mariadb -u root -ppassword -e 'select 1'" \
      --health-interval=10ms \
      --health-timeout=50ms \
      --health-retries=100 \
      --health-start-period=0s \
      mariadb:latest \
      --skip-name-resolve \
      --skip-log-bin \
      --performance-schema=OFF \
      --innodb-buffer-pool-size=64M \
      --innodb-log-file-size=16M \
      --max-connections=50
    `.replace(/\s/g, ' ')
    await execAsync(command)
    this.logger.info(`MySql starting at localhost:${port}`);
    const timerExec = performance.now()
    this.logger.info(`  docker run        - took: ${Math.floor(timerExec - timerStart)}ms`)

    this._connectionOptions = { port }
    await this.waitForMySqlReadyExec()
    const timerReady = performance.now()
    this.logger.info(`  waitForMySqlReady - took: ${Math.floor(timerReady - timerExec)}ms`)

    await this.migrate()
    const timerMigrated = performance.now()
    this.logger.info(`  migrate()         - took: ${Math.floor(timerMigrated - timerReady)}ms`)

    await this.seed()
    const timerSeeded = performance.now()
    this.logger.info(`  seed()            - took: ${Math.floor(timerSeeded - timerMigrated)}ms`)

    const timerEnd = performance.now()
    this.logger.info(`up()        - took: ${Math.floor(timerEnd - timerStart)}ms`)
  }

  get connectionOptions(): ConnectionOptionsMySql {
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

  /**
   * Call exec on the container to make sure mysql is ready for connections.
   *
   * The probe goes over TCP rather than the unix socket on purpose. The mariadb entrypoint
   * bootstraps the database on a temporary server started with `--skip-networking`, then stops
   * it and starts the real one. A socket probe passes against that temporary server and then
   * migrate() races its shutdown - `ERROR 2002 ... Can't connect to local server through socket`.
   * Only the real server listens on 3306, so a TCP probe cannot succeed too early.
   */
  private async waitForMySqlReadyExec(): Promise<void> {
    assert(this._connectionOptions)

    let attemptsMax = 150
    let delayMs = 35

    for (let attempt = 1; attempt <= attemptsMax; attempt++) {
      try {
        const command = `docker exec ${this.containerName} sh -c \
          'mariadb --protocol=TCP -h 127.0.0.1 -P 3306 -u root -ppassword -e "select 1" ${this.options.databaseName}'
        `
        await execAsync(command)
        logger.info(`MySql started after ${attempt} attempts (${attempt * delayMs}ms).`)
        return
      } catch (err: any) {
        if (attempt === attemptsMax) {
          throw new Error(`MySql failed to start after ${attemptsMax} attempts.\n${err.message}`)
        }
        // Extra whitespace for better printing.
        logger.debug(`Waiting for MySQL:      [attempt ${`${attempt}`.padStart(3)}/${attemptsMax}]`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  /**
   * Use the internal docker health check, it seems to be slightly faster.
   */
  private async waitForMySqlReadyInspect(): Promise<void> {
    assert(this._connectionOptions)

    let attemptsMax = 100
    let delayMs = 25

    for (let attempt = 1; attempt <= attemptsMax; attempt++) {
      try {
        const command = `docker inspect --format='{{.State.Health.Status}}' ${this.containerName}`
        const { stdout } = await execAsync(command, { silent: true })

        if (stdout.trim() !== 'healthy') {
          throw new Error('Not ready.')
        }
        logger.info(`MySql started after ${attempt} attempts).`)
        return
      } catch (err: any) {
        if (attempt === attemptsMax) {
          throw new Error(`MySql failed to start after ${attemptsMax} attempts.\n${err.message}`)
        }
        // Extra whitespace for better printing.
        logger.debug(`Waiting for MySQL:      [attempt ${`${attempt}`.padStart(3)}/${attemptsMax}]`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  private async migrate(): Promise<void> {
    assert(this._connectionOptions)

    // Sometimes migration fails even if MySQL is ready, so we wrap this in retries.
    let attemptsMax = 3
    let delayMs = 1000

    for (let attempt = 1; attempt <= attemptsMax; attempt++) {
      try {
        const type = this.options.migration.type
        switch (type) {
          case "knex":
            await this.migrateKnex()
            break;
          case "sql":
            await this.migrateSql()
            break
          default:
            throw new Error(`Unexpected migration type: ${type}`)
        }
        return
      } catch (err: any) {
        if (attempt === attemptsMax) {
          throw new Error(`migrate failed after ${attemptsMax}.\n${err.message}`)
        }
        logger.debug(`migrate()          [attempt ${`${attempt}`.padStart(3)}/${attemptsMax}]`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  private getKnexClient() {
    return knex({
      client: 'mysql2',
      connection: {
        host: 'localhost',
        port: this.connectionOptions.port,
        user: 'root',
        password: 'password',
        database: this.options.databaseName,
        timezone: '+00:00',
      },
      migrations: {
        tableName: 'migration',
        directory: './src/migrations'
      },
      seeds: {
        directory: './src/seeds'
      },
      // @ts-ignore
      userParams: {
        clock: this.clock
      }
    })
  }

  /**
   * @method migrateKnex()
   * @description Runs all of the knex migrations. It's quite slow so you probably want to use
   *   migrateSql() to restore the databse from the checkpoint sql file, and check that file into
   *   git.
   */
  private async migrateKnex(): Promise<void> {
    assert(this.options.migration.type === 'knex')

    const knexClient = this.getKnexClient();
    try {
      await knexClient.migrate.latest()
      logger.debug('migrateKnex() - complete.')

      if (this.options.migration.updateSqlFilePath) {
        await this.saveDatabaseCheckpoint(this.options.migration.updateSqlFilePath)
      }
    } finally {
      await knexClient.destroy()
    }
  }

  private async saveDatabaseCheckpoint(pathToCheckpoint: string): Promise<void> {
    try {
      logger.info(`saveDatabaseCheckpoint() - creating checkpoint at: ${pathToCheckpoint}`)

      // Dump the database inside the container to a known location.
      const containerTempFile = '/tmp/checkpoint_dump.sql'
      const dumpCmd = `docker exec ${this.containerName} sh -c \
        'mariadb-dump -u root -ppassword ${this.options.databaseName} > ${containerTempFile}'`;
      const { stderr: dumpStderr } = await execAsync(dumpCmd);

      if (dumpStderr && !dumpStderr.includes('Warning: Using a password')) {
        logger.warn('SQL dump warnings:', dumpStderr);
      }

      const copyCmd = `docker cp ${this.containerName}:${containerTempFile} ${pathToCheckpoint}`;
      const { stderr: copyStderr } = await execAsync(copyCmd);

      if (copyStderr) {
        logger.warn('Docker copy warnings:', copyStderr);
      }

      const addNoticeCmd = `echo "-- Note: This file was generated by ./testing/harness.ts.
      -- It is used to speed up the integration tests, but needs to be recreated every time a new
      -- migration is added. Refer to ./src/testing/harness.ts for instructions of how to update this
      -- snapshot.
      " > /tmp/checkpoint; \
        cat ${pathToCheckpoint} >> /tmp/checkpoint; \
      `.replace(/\ {2,}/g, '')
      await execAsync(addNoticeCmd, { silent: false })

      await execAsync(`mv /tmp/checkpoint ${pathToCheckpoint}`)
      logger.info(`SQL checkpoint saved to ${pathToCheckpoint}`)

    } catch (err: any) {
      logger.error(`saveDatabaseCheckpoint() failed with error: ${err.message}`)
      throw err
    }
  }

  private async migrateSql(): Promise<void> {
    assert(this.options.migration.type === 'sql')

    try {
      logger.debug(`migrateSql(): from: ${this.options.migration.sqlFilePath}.`)
      const cmd = `docker cp ${this.options.migration.sqlFilePath} ${this.containerName}:/tmp/checkpoint.sql && \
        docker exec -i ${this.containerName} sh -c 'mariadb -u root -ppassword ${this.options.databaseName} < /tmp/checkpoint.sql'
      `
      const { stdout, stderr } = await execAsync(cmd);

      if (stderr && !stderr.includes('warning')) {
        logger.debug('migrateSql() warnings:', stderr);
      }

      logger.debug(`migrateSql() from ${this.options.migration.sqlFilePath} completed`);
    } catch (err: any) {
      throw new Error(`migrateSql() from: ${this.options.migration.sqlFilePath} failed with error: ${err.message}.`)
    }
  }

  private async seed(): Promise<void> {
    const knexClient = this.getKnexClient();
    // knexClient.prototype.context = {
    //   date: new Date('2026-01-02')
    // }
    try {
      await knexClient.seed.run()
      logger.debug('seed() - complete.')
    } finally {
      await knexClient.destroy()
    }
  }
}