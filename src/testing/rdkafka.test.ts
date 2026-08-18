import { describe, it } from "node:test";
import Harness from "./harness"
import { sleepSeconds } from "./util";
import { Consumer, Producer } from "./kafka";
const ProducerLegacy = require('@mojaloop/central-services-stream').Util.Producer
const ConsumerLegacy = require('@mojaloop/central-services-stream').Kafka.Consumer

const harness = Harness.getInstance()

const NUM_MESSAGES = 1_000_000
const NUM_BATCHES = 10
const MESSAGES_PER_BATCH = Math.floor(NUM_MESSAGES / NUM_BATCHES)

const formatMs = (ms: number): string => {
  return ms.toLocaleString().split('.')[0]
}

const formatInt = (ms: number): string => {
  return ms.toLocaleString()
}

/**
 * This is a benchmark that compares the plain node-rdkafka performance to central-services-stream.
 */
describe('producer benchmark', () => {
  it('[node-rdkafka] connects and produces poll interval', async () => {
    await harness.up()

    const broker = `localhost:${harness.redpandaConnectionOptions.port}`
    const producer = new Producer(broker)

    try {
      await producer.connect(err => {
        console.error('producer error', err.message)
      })
      const testStart = performance.now()

      console.log(`[node-rdkafka] Producing: ${formatInt(NUM_MESSAGES)} messages (pollInterval = 50ms)`)

      for (let batchNum = 0; batchNum < NUM_BATCHES; batchNum++) {
        const batchStart = performance.now()
        let batch: Array<LegacyMessage> = []
        for (let messageNum = 0; messageNum < MESSAGES_PER_BATCH; messageNum++) {
          batch.push({
            from: "lewis",
            to: "lewis",
            id: 0,
            content: { "hello": true },
            type: "",
            metadata: undefined,
            pp: undefined
          })
        }

        await producer.produce('thingo', batch)
        const batchEnd = performance.now()
        console.log(`  - Produced: ${formatInt(MESSAGES_PER_BATCH)} messages in ${formatMs(batchEnd - batchStart)} ms`)
      }
      const testEnd = performance.now()
      console.log(`[node-rdkafka] produced ${formatInt(NUM_MESSAGES)} messages across ${formatInt(NUM_BATCHES)} batches took: ${formatMs(testEnd - testStart)} ms`)
    } finally {
      await producer.disconnect()
      await harness.down()
    }
  })

  it('[central-services-stream] connects and produces', async () => {
    await harness.up()
    const configs = [
      {
        topicConfig: {
          topicName: 'thingo',
        },
        kafkaConfig: {
          options: {
            messageCharset: "utf8"
          },
          topicConfig: {
            topicName: 'thingo',
          },
          rdkafkaConf: {
            "metadata.broker.list": `localhost:${harness.redpandaConnectionOptions.port}`,
            "client.id": "test-client",
            "event_cb": true,
            "dr_cb": true,
            "socket.keepalive.enable": true,
            "queue.buffering.max.messages": 10000000
          }
        }
      }
    ]

    try {
      await ProducerLegacy.connectAll(configs)
      const testStart = performance.now()

      console.log(`[central-services-stream] Producing: ${formatInt(NUM_MESSAGES)} messages`)

      for (let batchNum = 0; batchNum < NUM_BATCHES; batchNum++) {
        const batchStart = performance.now()
        let batch: Array<LegacyMessage> = []
        for (let messageNum = 0; messageNum < MESSAGES_PER_BATCH; messageNum++) {
          batch.push({
            from: "lewis",
            to: "lewis",
            id: 0,
            content: { "hello": true },
            type: "",
            metadata: undefined,
            pp: undefined
          })
        }

        await produceLegacyMessage('thingo', batch)

        const batchEnd = performance.now()
        console.log(`  - Produced: ${formatInt(MESSAGES_PER_BATCH)} messages in ${formatMs(batchEnd - batchStart)} ms`)
      }
      const testEnd = performance.now()
      console.log(`[central-services-stream] produced ${formatInt(NUM_MESSAGES)} messages across ${formatInt(NUM_BATCHES)} batches took: ${formatMs(testEnd - testStart)} ms`)
    } finally {
      await ProducerLegacy.disconnect()
      await harness.down()
    }
  })
})

describe('consumer benchmark', () => {
  const produceMessages = async () => {
    const broker = `localhost:${harness.redpandaConnectionOptions.port}`
    const producer = new Producer(broker)

    try {
      await producer.connect(err => {
        console.error('producer error', err.message)
      });

      console.log(`[setup] Producing: ${formatInt(NUM_MESSAGES)} messages.`)

      for (let batchNum = 0; batchNum < NUM_BATCHES; batchNum++) {
        let batch: Array<LegacyMessage> = []
        for (let messageNum = 0; messageNum < MESSAGES_PER_BATCH; messageNum++) {
          batch.push({
            from: "lewis",
            to: "lewis",
            id: 0,
            content: { "hello": true },
            type: "",
            metadata: undefined,
            pp: undefined
          })
        }

        await producer.produce('thingo', batch)
      }
    } finally {
      await producer.disconnect()
    }
  }

  it('[node-rdkafka] consumes all of the messages', async () => {
    await harness.up()
    await produceMessages()
    const broker = `localhost:${harness.redpandaConnectionOptions.port}`

    let countConsumed = 0
    let remainingRetries = 10
    const consumer = new Consumer('test-group', broker)
    try {
      console.log(`[node-rdkafka] consuming: ${formatInt(NUM_MESSAGES)} messages.`)
      const consumeStart = performance.now()

      await consumer.subscribe(['thingo'], (message) => {
        countConsumed += 1
      })

      while (countConsumed < NUM_MESSAGES) {
        if (remainingRetries === 0) {
          throw new Error(`Timed out waiting to consume ${formatInt(NUM_MESSAGES)}.`)
        }

        await sleepSeconds(1)
        console.log(`  -      consumed ${formatInt(countConsumed)} took: ${formatMs(performance.now() - consumeStart)} ms`)
        remainingRetries -= 1;
      }

      const consumeEnd = performance.now()
      console.log(`[node-rdkafka] consumed ${formatInt(NUM_MESSAGES)} took: ${formatMs(consumeEnd - consumeStart)} ms`)
    } finally {
      consumer.disconnect()
      harness.down()
    }
  })

  it('[central-services-stream] consumes all of the messages', async () => {
    await harness.up()
    await produceMessages()

    const consumerConfig = {
      topicConf: {
        "auto.offset.reset": 'earliest',
      },
      rdkafkaConf: {
        "group.id": 'test-consumer-group',
        "metadata.broker.list": `localhost:${harness.redpandaConnectionOptions.port}`,
        "client.id": "test-client",
        "socket.keepalive.enable": true,
        "queue.buffering.max.messages": 10000000
      },
    }
    const consumer = new ConsumerLegacy(['thingo'], consumerConfig)
    let countConsumed = 0
    let remainingRetries = 20
    try {
      console.log(`[central-services-stream] consuming: ${formatInt(NUM_MESSAGES)} messages.`)
      const consumeStart = performance.now()

      await consumer.connect()
      await consumer.consume((err: any, messages: Array<any>) => {
        countConsumed += 1
      })

      while (countConsumed < NUM_MESSAGES) {
        if (remainingRetries === 0) {
          throw new Error(`Timed out waiting to consume ${formatInt(NUM_MESSAGES)}.`)
        }

        await sleepSeconds(1)
        console.log(`  -      consumed ${formatInt(countConsumed)} took: ${formatMs(performance.now() - consumeStart)} ms`)
        remainingRetries -= 1;
      }

      const consumeEnd = performance.now()
      console.log(`[central-services-stream] consumed ${formatInt(NUM_MESSAGES)} took: ${formatMs(consumeEnd - consumeStart)} ms`)
    } finally {
      await new Promise((resolve, reject) => consumer.disconnect(resolve))
      harness.down()
    }
  })
})

type LegacyMessage = {
  from: string,
  to: string,
  id: number,
  content: any,
  type: string,
  metadata: any,
  pp: any
}

const produceLegacyMessage = async (topic: string, messages: Array<LegacyMessage>): Promise<void> => {
  const topicConf = {
    topicName: topic,
  }
  const config = {

  }
  const promises = Promise.all(messages.map(message => {
    return ProducerLegacy.produceMessage(message, topicConf, config)
  }))
  await promises
}
