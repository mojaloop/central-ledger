'use strict'

const Test = require('tape')
const Base = require('../../base')

Test('return error if required field missing', async function (assert) {
  let req = Base.buildRequest({url: '/charge/quote', method: 'POST', payload: {}})
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertBadRequestError(assert, res, 'child "amount" fails because [amount is required]')
  await server.stop()
  assert.end()
})
