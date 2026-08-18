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

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { makeConfig, parseAndValidateConfig, resolveConfig } from './resolver'
import parseStringsInObject from 'parse-strings-in-object'
import RC from 'rc'
import path from 'node:path'

describe('lib/config/resolver', () => {
  it('loads the config', () => {
    const config = makeConfig()
    assert.ok(config)
  })

  it('throws if LEDGER !== LEGACY', () => {
    // Arrange
    const pathToConfigFile = path.join(__dirname, '../../..', 'config/default.json')
    const raw = parseStringsInObject(RC('CLEDG', require(pathToConfigFile)))
    const resolved = resolveConfig(raw)

    // Act
    resolved.LEDGER = 'LOCKSTEP'

    // Assert
    assert.throws(() => parseAndValidateConfig(resolved))
  })

  it('throws if EXPERIMENTAL.PROVISIONING is enabled', () => {
    // Arrange
    const pathToConfigFile = path.join(__dirname, '../../..', 'config/default.json')
    const raw = parseStringsInObject(RC('CLEDG', require(pathToConfigFile)))
    const resolved = resolveConfig(raw)

    // Act
    resolved.EXPERIMENTAL = {
      PROVISIONING: {
        enabled: true,
        currencies: ['USD'],
        hubAlertEmailAddress: 'test@email.com'
      }
    }

    // Assert
    assert.throws(() => parseAndValidateConfig(resolved))
  })
})