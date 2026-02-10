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

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------

 ******/

import { ProxyCacheConfig } from '@mojaloop/inter-scheme-proxy-cache-lib'

/**
 * @interface ApplicationConfig
 * @description Root config for central-ledger
 */
export interface ApplicationConfig {
  /**
   * The port number for the server to listen on.
   * @default 3001
   */
  PORT: number,
  HOSTNAME: string,

  /**
   * SQL Database Config
   */
  DATABASE: DatabaseConfig,
  MAX_FULFIL_TIMEOUT_DURATION_SECONDS: number,
  MONGODB_HOST: string,
  MONGODB_PORT: number,
  MONGODB_USER: string,
  MONGODB_PASSWORD: string,
  MONGODB_DATABASE: string,
  MONGODB_DEBUG: boolean,
  MONGODB_DISABLED: boolean,
  AMOUNT: {
    PRECISION: number,
    SCALE: number,
  },
  ERROR_HANDLING: {
    includeCauseExtension: boolean,
    truncateExtensions: boolean,
  },
  HANDLERS_DISABLED: boolean
  HANDLERS_API_DISABLED: boolean,
  HANDLERS_TIMEOUT: {
    DIST_LOCK: DistLockConfig,
    DISABLED: boolean,
    TIMEXP: string,
    TIMEZONE: string,
  },
  HANDLERS_TIMEOUT_DISABLED: boolean,
  HANDLERS_TIMEOUT_TIMEXP: string,
  HANDLERS_TIMEOUT_TIMEZONE: string,
  CACHE_CONFIG: {
    CACHE_ENABLED: boolean
    MAX_BYTE_SIZE: number,
    EXPIRES_IN_MS: number,
  },
  PROXY_CACHE_CONFIG: {
    enabled: boolean,
    type: string,
    proxyConfig: ProxyCacheConfig
  },
  KAFKA_CONFIG: KafkaConfig,
  PARTICIPANT_INITIAL_POSITION: number,
  RUN_MIGRATIONS: boolean,
  RUN_DATA_MIGRATIONS: boolean,
  INTERNAL_TRANSFER_VALIDITY_SECONDS: number,
  ENABLE_ON_US_TRANSFERS: boolean,
  HUB_ID: number,
  HUB_NAME: string,
  HUB_ACCOUNTS: Array<string>,
  INSTRUMENTATION_METRICS_DISABLED: boolean,
  INSTRUMENTATION_METRICS_LABELS: InstrumentationMetricsLabels,
  INSTRUMENTATION_METRICS_CONFIG: InstrumentationConfig,
  API_DOC_ENDPOINTS_ENABLED: boolean,
  PAYEE_PARTICIPANT_CURRENCY_VALIDATION_ENABLED: boolean,

  /**
   * Whether or not to print the routes when the server is started.
   * @default true
   */
  SERVER_PRINT_ROUTES_ON_STARTUP: boolean,
  /**
   * Configures the underlying primary ledger.
   * - `LEGACY` uses the existing MySQL central-ledger implementation.
   * - `TIGERBEETLE` uses the TigerBeetle OLTP Database.
   * - `LOCKSTEP` uses both the LEGACY and TIGERBEETLE ledgers in parallel, used to verify
   *    the Ledgers to one another.
   * 
   * At the momeny, only LEGACY is supported, any other value will fail with a validation error.
   *
   * @default 'LEGACY'
   */
  LEDGER: LedgerType
  
  /**
   * Experimental Configs. Not recommended for production usage.
   */
  EXPERIMENTAL: {
    
    /**
     * When enabled, the switch will automatically provision itself on startup by registering the 
     * required hub accounts.
     */
    PROVISIONING: {
      /**
       * @default false
       */
      enabled: boolean,

      /**
       * A list of ISO Currency codes that the switch supports.
       */
      currencies: Array<string>,

      /**
       * Which email address to register for the following hub alerts:
       * - `SETTLEMENT_TRANSFER_POSITION_CHANGE_EMAIL`
       * - `NET_DEBIT_CAP_ADJUSTMENT_EMAIL`
       * - `NET_DEBIT_CAP_THRESHOLD_BREACH_EMAIL`
       */
      hubAlertEmailAddress: string | undefined,
    }
  }
}

export interface DatabaseConfig {
  client: string,
  connection: {
    host: string,
    port: number,
    user: string,
    password: string,
    database: string,
  },
  pool: {
    min: number,
    max: number
    /**
     * Acquire promises are rejected after this many milliseconds if a resource cannot be acquired.
     */
    acquireTimeoutMillis: number
    /**
     * Create operations are cancelled after this many milliseconds if a resource cannot be acquired.
     */
    createTimeoutMillis: number
    /**
     * Destroy operations are awaited for at most this many milliseconds  new resources will be 
     * created after this timeout.
     */
    destroyTimeoutMillis: number
    /**
     * Free resouces are destroyed after this many milliseconds.
     */
    idleTimeoutMillis: number
    /**
     * How often to check for idle resources to destroy.
     */
    reapIntervalMillis: number
    /**
     * How long to idle after failed create before trying again.
     */
    createRetryIntervalMillis: number
  }
  debug: boolean
}


export type LedgerType = 'LEGACY' | 'TIGERBEETLE' | 'LOCKSTEP';

export interface DistLockRedisConfig {
  type: string,
  cluster: Array<{
    host: string,
    port: number,
  }>
}

export interface DistLockConfig {
  enabled: boolean,
  lockTimeout: number,
  acquireTimeout: number,
  driftFactor: number,
  retryCount: number,
  retryDelay: number,
  retryJitter: number,
  redisConfigs: Array<DistLockRedisConfig>,
}

interface KafkaTopicTemplate {
  TEMPLATE: string,
  REGEX: string
}

export interface KafkaConsumerConfig {
  config: {
    options: KafkaConsumerGeneralOptions,
    rdkafkaConf: KafkaConsumerRdKafkaConfig,
    topicConf: KafkaConsumerTopicConfig
  }
}

export interface KafkaProducerConfig {
  config: {
    options: KafkaProducerGeneralOptions,
    rdkafkaConf: KafkaProducerRdKafkaConfig,
    topicConf: KafkaProducerTopicConfig
  }
}

interface KafkaConsumerGeneralOptions {
  mode: 0 | 1 | 2,
  batchSize: number,
  pollFrequency: number,
  recursiveTimeout: number,
  messageCharset: string
  messageAsJSON: boolean,
  sync: boolean
  consumeTimeout: number
}

interface KafkaProducerGeneralOptions {
  mode?: 0 | 1 | 2,
  batchSize?: number,
  pollFrequency?: number,
  recursiveTimeout?: number,
  messageCharset?: string
  messageAsJSON?: boolean,
  sync?: boolean
  consumeTimeout?: number
}

interface KafkaConsumerRdKafkaConfig {
  "metadata.broker.list": string,
  "client.id": string,
  "socket.keepalive.enable": true,
  "group.id": string
  "allow.auto.create.topics": true,
}

interface KafkaProducerRdKafkaConfig {
  "metadata.broker.list": string,
  "client.id": string,
  "socket.keepalive.enable": true,
  "event_cb": true,
  "dr_cb": true,
  "queue.buffering.max.messages": number
}

interface KafkaConsumerTopicConfig {
  'auto.offset.reset': string,
}

interface KafkaProducerTopicConfig {
  'request.required.acks': string,
  'partitioner': string,
}

export interface KafkaConfig {
  EVENT_TYPE_ACTION_TOPIC_MAP: {
    POSITION: {
      PREPARE: string | null,
      FX_PREPARE: string | null,
      BULK_PREPARE: string | null,
      COMMIT: string | null,
      BULK_COMMIT: string | null,
      RESERVE: string | null,
      FX_RESERVE: string | null,
      TIMEOUT_RESERVED: string | null,
      FX_TIMEOUT_RESERVED: string | null,
      ABORT: string | null,
      FX_ABORT: string | null,
    }
  },
  TOPIC_TEMPLATES: {
    PARTICIPANT_TOPIC_TEMPLATE: KafkaTopicTemplate,
    GENERAL_TOPIC_TEMPLATE: KafkaTopicTemplate,
  },
  CONSUMER: {
    BULK: {
      PREPARE: KafkaConsumerConfig,
      PROCESSING: KafkaConsumerConfig,
      FULFIL: KafkaConsumerConfig,
      GET: KafkaConsumerConfig,
    },
    TRANSFER: {
      PREPARE: KafkaConsumerConfig,
      GET: KafkaConsumerConfig,
      FULFIL: KafkaConsumerConfig,
      POSITION: KafkaConsumerConfig,
      POSITION_BATCH: KafkaConsumerConfig,
    },
    ADMIN: {
      TRANSFER: KafkaConsumerConfig
    },
    NOTIFICATION: {
      EVENT: KafkaConsumerConfig
    }
  },
  PRODUCER: {
    BULK: {
      PROCESSING: KafkaProducerConfig
    }
    TRANSFER: {
      PREPARE: KafkaProducerConfig,
      FULFIL: KafkaProducerConfig,
      POSITION: KafkaProducerConfig,
    },
    NOTIFICATION: {
      EVENT: KafkaProducerConfig,
    },
    ADMIN: {
      TRANSFER: KafkaProducerConfig
    }
  }
}

export interface InstrumentationMetricsLabels {
  fspId: string
}

export interface InstrumentationConfig {
  timeout: number,
  prefix: string,
  defaultLabels: {
    serviceName: string
  }
}
