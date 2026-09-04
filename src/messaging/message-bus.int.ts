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

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------
 ******/


import { after, before, describe, it } from 'node:test'
import Harness from '../testing/harness'
import { DispatchTransferHandler } from '../handlers/dispatch-transfer-handler'
import { MessageBus } from './message-bus'
import { Snapshot } from '../testing/snapshot'
import { PositionHandlerV2 } from '../handlers/position-v2'

const harness = Harness.getInstance()
let dispatchHandler: DispatchTransferHandler
let messageBus: MessageBus

describe('messaging/message-bus', () => {
  before(async () => {
    await harness.up()
  })

  after(async () => {
    await harness.down()
  })

  it('getConsumerTopics() after init()', async () => {
    await harness.setupGlobals()
    const consumers = harness.messageBus.getConsumerTopics().sort()
    Snapshot.from(`[
      "topic-admin-transfer",
      "topic-transfer-fulfil",
      "topic-transfer-position-batch",
      "topic-transfer-prepare"
    ]`).checkUnwrap(consumers)
  })

  it('getConsumerTopics() after deinit()', async () => {
    await harness.teardownGlobals()
    const consumers = harness.messageBus.getConsumerTopics().sort()
    Snapshot.from(`[]`).checkUnwrap(consumers)
  })
})
