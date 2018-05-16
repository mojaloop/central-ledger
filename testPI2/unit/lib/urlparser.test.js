'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const Config = require('../../../src/lib/config')
const UrlParser = require('../../../src/lib/urlparser')

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
