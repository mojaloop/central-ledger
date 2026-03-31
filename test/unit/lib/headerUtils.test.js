/**
 * License
 * --------------
 * Copyright © 2020-2025 Mojaloop Foundation
 * The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 *
 * Contributors
 * --------------
 * This is the official list of the Mojaloop project contributors for this file.
 * Names of the original copyright holders (individuals or organizations)
 * should be listed with a '*' in the first column. People who have
 * contributed from an organization can be listed under the organization
 * that actually holds the copyright for their contributions (see the
 * Mojaloop Foundation for an example). Those individuals should have
 * their names indented and be marked with a '-'. Email address can be added
 * optionally within square brackets <email>.
 *
 * * Mojaloop Foundation
 *   - Name Surname <name.surname@mojaloop.io>
 *
 * * Infitx
 *   - Vijay <vijaya.guthi@infitx.com>
 * --------------
 */
'use strict'
const test = require('tape')
const sinon = require('sinon')
const Logger = require('../../shared/logger').logger
const {
  getNormalizedHeaderValue,
  parseBaggageHeader,
  shouldSkipParticipantCache
} = require('../../lib/headerUtils')
test('getNormalizedHeaderValue', t => {
  sinon.stub(Logger, 'debug')
  sinon.stub(Logger, 'isDebugEnabled').value(true)

  t.equal(getNormalizedHeaderValue(null, 'foo'), undefined, 'returns undefined for null headers')
  t.equal(getNormalizedHeaderValue(undefined, 'foo'), undefined, 'returns undefined for undefined headers')
  t.equal(getNormalizedHeaderValue('not-an-object', 'foo'), undefined, 'returns undefined for non-object headers')
  t.equal(getNormalizedHeaderValue({ bar: 'baz' }, 'foo'), undefined, 'returns undefined if header not found')
  t.equal(getNormalizedHeaderValue({ foo: 'bar' }, 'foo'), 'bar', 'returns string value if header found')
  t.equal(getNormalizedHeaderValue({ Foo: 'bar' }, 'foo'), 'bar', 'returns string value if header found (case-insensitive)')
  t.equal(getNormalizedHeaderValue({ foo: ['a', 'b'] }, 'foo'), 'a,b', 'joins array values with comma')
  t.equal(getNormalizedHeaderValue({ foo: null }, 'foo'), undefined, 'returns undefined for null value')
  t.equal(getNormalizedHeaderValue({ foo: undefined }, 'foo'), undefined, 'returns undefined for undefined value')

  sinon.restore()
  t.end()
})

test('parseBaggageHeader', t => {
  t.deepEqual(parseBaggageHeader(), {}, 'returns empty object for undefined input')
  t.deepEqual(parseBaggageHeader(''), {}, 'returns empty object for empty string')
  t.deepEqual(parseBaggageHeader([]), {}, 'returns empty object for empty array')
  t.deepEqual(parseBaggageHeader('a=1,b=2'), { a: '1', b: '2' }, 'parses comma-separated key=value pairs')
  t.deepEqual(parseBaggageHeader(['a=1', 'b=2']), { a: '1', b: '2' }, 'parses array of key=value pairs')
  t.deepEqual(parseBaggageHeader(' a = 1 , b = 2 '), { a: '1', b: '2' }, 'trims keys and values')
  t.deepEqual(parseBaggageHeader('foo=bar=baz'), { foo: 'bar=baz' }, 'handles values with = in them')
  t.deepEqual(parseBaggageHeader('a=1,broken'), { a: '1' }, 'ignores malformed entries')
  t.end()
})

test('shouldSkipParticipantCache', t => {
  sinon.stub(Logger, 'debug')
  sinon.stub(Logger, 'isDebugEnabled').value(true)

  t.equal(shouldSkipParticipantCache({}), false, 'returns false if no baggage header')
  const headers1 = { baggage: 'test-instruction=other' }
  t.equal(shouldSkipParticipantCache(headers1), false, 'returns false if test-instruction is not skip-participant-cache')
  const headers2 = { baggage: 'test-instruction=skip-participant-cache' }
  t.equal(shouldSkipParticipantCache(headers2), true, 'returns true if test-instruction=skip-participant-cache')
  const headers3 = { baggage: ['test-instruction=skip-participant-cache'] }
  t.equal(shouldSkipParticipantCache(headers3), true, 'works with array baggage header')
  const headers4 = { Baggage: 'test-instruction=skip-participant-cache' }
  t.equal(shouldSkipParticipantCache(headers4), true, 'is case-insensitive for header name')

  sinon.restore()
  t.end()
})
