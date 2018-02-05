'use strict'

const Test = require('tape')
const bluebird = require('bluebird')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('GET /accounts', getTest => {
  getTest.test('should return all accounts', function (assert) {
    const account1Name = 'a' + Fixtures.generateAccountName()
    const account2Name = 'b' + Fixtures.generateAccountName()

    bluebird.all([Base.createAccount(account1Name), Base.createAccount(account2Name)])
      .then(([account1Res, account2Res]) => {
        Base.getAdmin(`/accounts/${account1Name}`)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            assert.equal(res.body.name, account1Res.body.name)
            assert.equal(res.body.created, account1Res.body.created)
            assert.equal(res.body.id, account1Res.body.id)
            assert.equal(res.body.emailAddress, account1Res.body.emailAddress)
            assert.end()
          })
      })
  })

  getTest.end()
})

