'use strict'

const Test = require('tape')
const Base = require('../../base')

Test('return error if required field missing', assert => {
  let req = Base.buildRequest({ url: '/charges/quote', method: 'POST', payload: { } })

  Base.setup().then(server => {
    server.inject(req, res => {
      Base.assertBadRequestError(assert, res, [{ message: 'amount is required', params: { key: 'amount' } }])
      assert.end()
    })
  })
})

