'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('PUT /account/:name', putTest => {
  putTest.test('should update an account', test => {
    let accountName = Fixtures.generateAccountName()
    let isDisabled = true

    Base.createAccount(accountName)
      .expect(201)
      .then((accountRes) => {
        Base.updateAccount(accountName, isDisabled)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.name, accountRes.body.name)
            test.equal(res.body.id, accountRes.body.id)
            test.equal(res.body.created, accountRes.body.created)
            test.equal(res.body.is_disabled, isDisabled)
            test.equal(res.body.emailAddress, accountRes.body.emailAddress)
            test.end()
          })
      })
  })

  putTest.end()
})
