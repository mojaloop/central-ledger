'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const P = require('bluebird')
const Fixtures = require('../../../fixtures')
const Model = require('../../../../src/domain/token/model')
const AccountModel = require('../../../../src/domain/account/model')

const createAccount = () => {
  const accountName = Fixtures.generateAccountName()
  return AccountModel.create({ name: accountName, hashedPassword: 'password', emailAddress: accountName + '@test.com' })
}

const generateToken = ({ accountId }, expiration = null) => {
  const token = Uuid().toString()
  return Model.create({ accountId, token, expiration })
}

Test('Token Model', modelTest => {
  modelTest.test('byAccount should', tokensByAccountTest => {
    tokensByAccountTest.test('return tokens for account', test => {
      P.all([
        createAccount(),
        createAccount()
      ]).then(([account1, account2]) => {
        return P.all([
          generateToken(account1),
          generateToken(account2),
          generateToken(account1)
        ]).then(([token1, token2, token3]) => {
          return Model.byAccount(account1).then((results) => ({ results, token1, token2, token3 }))
        })
      }).then(({ results, token1, token2, token3 }) => {
        test.equal(results.length, 2)
        test.ok(results.find(t => t.token === token1.token))
        test.ok(results.find(t => t.token === token3.token))
        test.notOk(results.find(t => t.token === token2.token))
        test.end()
      })
    })

    tokensByAccountTest.test('return admin tokens if accountId is null', test => {
      createAccount()
      .then(account1 => {
        return P.all([
          generateToken(account1),
          generateToken({})
        ]).then(([token1, token2]) => {
          return Model.byAccount({ accountId: null }).then((results) => ({ results, token1, token2 }))
        })
      })
      .then(({ results, token1, token2 }) => {
        test.equal(results.length, 1)
        test.ok(results.find(t => t.token === token2.token))
        test.notOk(results.find(t => t.token === token1.token))
        test.end()
      })
    })

    tokensByAccountTest.end()
  })

  modelTest.test('removeExpired should', removeExpiredTest => {
    removeExpiredTest.test('remove all expired tokens', test => {
      let futureExpiration = Fixtures.getCurrentUTCTimeInMilliseconds() + 60000
      let pastExpiration = Fixtures.getCurrentUTCTimeInMilliseconds() - 60000

      createAccount()
      .then(account1 => {
        return P.all([
          generateToken(account1, futureExpiration),
          generateToken(account1, futureExpiration),
          generateToken(account1, pastExpiration),
          generateToken(account1, pastExpiration)
        ])
        .then(([token1, token2, token3, token4]) => {
          return Model.byAccount(account1).then(results => {
            test.equal(results.length, 4)
            return Model.removeExpired().then(results => {
              test.equal(results.length, 2)
            })
          })
          .then(() => {
            return Model.byAccount(account1).then(results => {
              test.equal(results.length, 2)
              test.end()
            })
          })
        })
      })
    })

    removeExpiredTest.end()
  })

  modelTest.end()
})
