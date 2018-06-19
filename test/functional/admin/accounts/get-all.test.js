'use strict'

const Test = require('tape')
const Logger = require('@mojaloop/central-services-shared').Logger
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('GET /accounts', getTest => {
  getTest.test('should return all accounts', async function (assert) {
    const account1Name = 'a' + Fixtures.generateAccountName()
    const account2Name = 'b' + Fixtures.generateAccountName()
    try {
      const account1Res = await Base.createAccount(account1Name)
      const account2Res = await Base.createAccount(account2Name)
      const res = await Base.getAdmin('/accounts')
      assert.equal(res.body[0].name, account1Res.body.name)
      assert.equal(res.body[0].created, account1Res.body.created)
      assert.equal(res.body[0].id, account1Res.body.id)
      assert.equal(res.body[0].emailAddress, account1Res.body.emailAddress)
      assert.equal(res.body[1].name, account2Res.body.name)
      assert.equal(res.body[1].created, account2Res.body.created)
      assert.equal(res.body[1].id, account2Res.body.id)
      assert.equal(res.body[1].emailAddress, account2Res.body.emailAddress)
      assert.end()
    } catch (e) {
      Logger.info(e)
    }
  })

  getTest.end()
})

