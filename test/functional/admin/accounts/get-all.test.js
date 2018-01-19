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
      Base.getAdmin('/accounts')
        .expect(200)
        .expect('Content-Type', /json/)
        .then(res => {
          assert.equal(res.body[0].name, account1Res.body.name)
          assert.equal(res.body[0].created, account1Res.body.created)
          assert.equal(res.body[0].id, account1Res.body.id)
          assert.equal(res.body[0].emailAddress, account1Res.body.emailAddress)
          assert.equal(res.body[1].name, account2Res.body.name)
          assert.equal(res.body[1].created, account2Res.body.created)
          assert.equal(res.body[1].id, account2Res.body.id)
          assert.equal(res.body[1].emailAddress, account2Res.body.emailAddress)
          assert.end()
        })
    })
  })

  getTest.end()
})

