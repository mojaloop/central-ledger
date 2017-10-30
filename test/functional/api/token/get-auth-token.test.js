'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('GET /auth_token', getTest => {
  getTest.test('should return token', test => {
    const accountName = Fixtures.generateAccountName()
    const password = '1234'

    Base.createAccount(accountName, password)
    .then(res => {
      Base.getApi('/auth_token', Base.basicAuth(accountName, password))
        .expect('Content-Type', /json/)
        .then(res => {
          const token = res.body.token
          test.ok(token)
          test.ok(token.length > 74)
          test.notEqual(token, password)
          test.end()
        })
    })
  })

  getTest.end()
})
