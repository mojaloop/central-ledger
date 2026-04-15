#!/usr/bin/env node

import { promisify } from 'node:util'
import childProcess from 'node:child_process'
const exec = promisify(childProcess.exec)

// Consumer groups to check (central-ledger and ml-api-adapter).
const consumerGroups = [
  'cl-group-transfer-prepare',
  'cl-group-transfer-fulfil',
  'cl-group-transfer-position',
  'ml-group-notification-event'
]
const retries = 30
const sleepMs = 10 * 1000
let count = 0

/**
 * wait-for-kafka-consumers.js
 * @description Instead of sleeping and hoping the kafka consumer groups have rebalanced, check them explicitly.
 *
 * @example
 * ./wait-for-kafka-consumers.js
 */
const main = async () => {
  console.log('Waiting for Kafka consumer groups to be ready.')

  while (count < retries) {
    let allReady = true
    for (const group of consumerGroups) {
      const cmd = `docker exec cl_kafka /opt/bitnami/kafka/bin/kafka-consumer-groups.sh \
      --bootstrap-server localhost:29092 \
      --describe \
      --group "${group}" 2>&1`
      const outputDockerExec = await exec(cmd)
      const parsed = parseConsumerGroupOutput(outputDockerExec.stdout)
      if (!parsed.exists) {
        console.log(`Group: ${group.padEnd(30, ' ')} does not exist.`)
        allReady = false
        continue
      }

      if (parsed.exists && parsed.assignedPartitions === 0) {
        console.log(`Group: ${group.padEnd(30, ' ')} has no partitions assigned.`)
        allReady = false
        continue
      }

      const countPartitions = parsed.assignedPartitions
      console.log(`Group: ${group.padEnd(30, ' ')} has ${countPartitions} partition${countPartitions === 1 ? '' : 's'} assigned.`)
    }
    if (allReady) {
      return
    }

    count += 1
    console.log(`Retry: ${count}/${retries} - waiting ${sleepMs}ms.`)
    await new Promise(resolve => setTimeout(resolve, sleepMs))
  }
}

function parseConsumerGroupOutput (stdout) {
  const lines = stdout.split('\n')

  if (stdout.includes('does not exist')) {
    return { exists: false, assignedPartitions: 0 }
  }

  if (stdout.includes('has no active members')) {
    return { exists: true, assignedPartitions: 0 }
  }

  const parsedLines = lines
    .filter(line => line.trim() && !line.startsWith('GROUP') && !line.startsWith('Consumer group'))
    .map(line => {
      const [group, topic, partition, currentOffset, logEndOffset, lag] = line.trim().split(/\s+/)
      return { group, topic, partition: parseInt(partition, 10), currentOffset, logEndOffset, lag }
    })
    .filter(row => !isNaN(row.partition))

  return { exists: true, assignedPartitions: parsedLines.length }
}

main()
  .then(() => {
    console.log('All consumer groups ready.')
  }).catch(err => {
    console.error('wait-for-kafka-consumers.js failed with error:')
    console.error(err)
    process.exit(1)
  })
