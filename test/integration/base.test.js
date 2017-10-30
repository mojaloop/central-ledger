'use strict'

const Test = require('tape')
const Db = require('../../src/db')
const Config = require('../../src/lib/config')

Test('setup', setupTest => {
  setupTest.test('connect to database', test => {
    Db.connect(Config.DATABASE_URI).then(() => {
      test.pass()
      test.end()
    })
  })
  setupTest.end()
})

Test.onFinish(function () {
  Db.disconnect()
})
