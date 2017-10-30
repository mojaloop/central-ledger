'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const Config = require('../../../src/lib/config')
const UrlParser = require('../../../src/lib/urlparser')

Test('nameFromAccountUri', nameFromAccountUriTest => {
  nameFromAccountUriTest.test('return null if not url', t => {
    UrlParser.nameFromAccountUri('fjdklsjfld', (err, name) => {
      t.equal(err, 'no match')
      t.equal(name, null)
      t.end()
    })
  })

  nameFromAccountUriTest.test('return null if url not start with hostname', t => {
    UrlParser.nameFromAccountUri('http://test/accounts/name', (err, name) => {
      t.equal(err, 'no match')
      t.equal(name, null)
      t.end()
    })
  })

  nameFromAccountUriTest.test('return name if url matches pattern', t => {
    const hostName = Config.HOSTNAME
    const accountName = 'account1'
    UrlParser.nameFromAccountUri(`${hostName}/accounts/${accountName}`, (err, name) => {
      t.notOk(err)
      t.equal(name, accountName)
      t.end()
    })
  })

  nameFromAccountUriTest.test('return value if no callback provided', t => {
    const hostName = Config.HOSTNAME
    const accountName = 'account1'
    const result = UrlParser.nameFromAccountUri(`${hostName}/accounts/${accountName}`)
    t.equal(result, accountName)
    t.end()
  })

  nameFromAccountUriTest.test('return null if no callback provided', t => {
    const result = UrlParser.nameFromAccountUri('not match')
    t.equal(result, null)
    t.end()
  })

  nameFromAccountUriTest.end()
})

Test('accountNameFromTransfersRoute', accountNameFromTransfersRouteTest => {
  accountNameFromTransfersRouteTest.test('return null if not url', t => {
    UrlParser.accountNameFromTransfersRoute('fjdklsjfld')
    .catch(e => {
      t.equal(e.message, 'No matching account found in url')
      t.end()
    })
  })

  accountNameFromTransfersRouteTest.test('return name if url matches pattern', t => {
    const accountName = 'account1'
    UrlParser.accountNameFromTransfersRoute(`/accounts/${accountName}/transfers`)
    .then(name => {
      t.equal(name, accountName)
      t.end()
    })
  })

  accountNameFromTransfersRouteTest.end()
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

Test('toAccountUri', toAccountUriTest => {
  toAccountUriTest.test('return path', t => {
    const hostName = Config.HOSTNAME
    const name = 'account-name'
    t.equal(UrlParser.toAccountUri(name), hostName + '/accounts/' + name)
    t.end()
  })

  toAccountUriTest.test('return value if already account uri', test => {
    const hostName = Config.HOSTNAME
    const name = `${hostName}/accounts/account-name`
    test.equal(UrlParser.toAccountUri(name), name)
    test.end()
  })
  toAccountUriTest.end()
})
