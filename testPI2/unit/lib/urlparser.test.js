/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const Config = require('../../../src/lib/config')
const UrlParser = require('../../../src/lib/urlParser')

Test('nameFromParticipantUri', nameFromParticipantUriTest => {
  nameFromParticipantUriTest.test('return null if not url', t => {
    UrlParser.nameFromParticipantUri('fjdklsjfld', (err, name) => {
      t.equal(err, 'no match')
      t.equal(name, null)
      t.end()
    })
  })

  nameFromParticipantUriTest.test('return null if url not start with hostname', t => {
    UrlParser.nameFromParticipantUri('http://test/participants/name', (err, name) => {
      t.equal(err, 'no match')
      t.equal(name, null)
      t.end()
    })
  })

  nameFromParticipantUriTest.test('return name if url matches pattern', t => {
    const hostName = Config.HOSTNAME
    const participantName = 'participant1'
    UrlParser.nameFromParticipantUri(`${hostName}/participants/${participantName}`, (err, name) => {
      t.notOk(err)
      t.equal(name, participantName)
      t.end()
    })
  })

  nameFromParticipantUriTest.test('return value if no callback provided', t => {
    const hostName = Config.HOSTNAME
    const participantName = 'participant1'
    const result = UrlParser.nameFromParticipantUri(`${hostName}/participants/${participantName}`)
    t.equal(result, participantName)
    t.end()
  })

  nameFromParticipantUriTest.test('return null if no callback provided', t => {
    const result = UrlParser.nameFromParticipantUri('not match')
    t.equal(result, null)
    t.end()
  })

  nameFromParticipantUriTest.end()
})

Test('participantNameFromTransfersRoute', participantNameFromTransfersRouteTest => {
  participantNameFromTransfersRouteTest.test('return null if not url', t => {
    UrlParser.participantNameFromTransfersRoute('fjdklsjfld')
    .catch(e => {
      t.equal(e.message, 'No matching participant found in url')
      t.end()
    })
  })

  participantNameFromTransfersRouteTest.test('return name if url matches pattern', t => {
    const participantName = 'participant1'
    UrlParser.participantNameFromTransfersRoute(`/participants/${participantName}/transfers`)
    .then(name => {
      t.equal(name, participantName)
      t.end()
    })
  })

  participantNameFromTransfersRouteTest.end()
})

Test('idFromTransferUri', idFromTransferUriTest => {
  idFromTransferUriTest.test('err if not uri', t => {
    UrlParser.idFromTransferUri('not a uri', (err, id) => {
      t.equal(err, 'no match')
      t.equal(id, null)
      t.end()
    })
  })

  idFromTransferUriTest.test('err if not begins with hostname', t => {
    UrlParser.idFromTransferUri(`http://not-host-name/transfers/${Uuid()}`, (err, id) => {
      t.equal(err, 'no match')
      t.equal(id, null)
      t.end()
    })
  })

  idFromTransferUriTest.test('id if uri contains hostname and uuid', t => {
    const hostname = Config.HOSTNAME
    const transferId = Uuid()
    UrlParser.idFromTransferUri(`${hostname}/transfers/${transferId}`, (err, id) => {
      t.equal(err, null)
      t.equal(id, transferId)
      t.end()
    })
  })

  idFromTransferUriTest.test('return id if no callback provided', t => {
    const hostname = Config.HOSTNAME
    const transferId = Uuid()
    const result = UrlParser.idFromTransferUri(`${hostname}/transfers/${transferId}`)
    t.equal(result, transferId)
    t.end()
  })

  idFromTransferUriTest.test('return null if no callback provided', t => {
    const result = UrlParser.idFromTransferUri('no match')
    t.equal(result, null)
    t.end()
  })

  idFromTransferUriTest.end()
})

Test('toTransferUri', toTransferUriTest => {
  toTransferUriTest.test('return path', t => {
    const hostName = Config.HOSTNAME
    const id = Uuid()
    t.equal(UrlParser.toTransferUri(id), hostName + '/transfers/' + id)
    t.end()
  })

  toTransferUriTest.test('return value if already transfer uri', test => {
    const hostName = Config.HOSTNAME
    const id = `${hostName}/transfers/${Uuid()}`
    test.equal(UrlParser.toTransferUri(id), id)
    test.end()
  })
  toTransferUriTest.end()
})

Test('toParticipantUri', toParticipantUriTest => {
  toParticipantUriTest.test('return path', t => {
    const hostName = Config.HOSTNAME
    const name = 'participant-name'
    t.equal(UrlParser.toParticipantUri(name), hostName + '/participants/' + name)
    t.end()
  })

  toParticipantUriTest.test('return value if already participant uri', test => {
    const hostName = Config.HOSTNAME
    const name = `${hostName}/participants/participant-name`
    test.equal(UrlParser.toParticipantUri(name), name)
    test.end()
  })
  toParticipantUriTest.end()
})
