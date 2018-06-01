'use strict'

const Test = require('tape')
const Base = require('../../base')
// const Logger = require('@mojaloop/central-services-shared').Logger

Test('return error if required field missing', async function (assert) {
  let req = Base.buildRequest({url: '/participants', method: 'POST', payload: {}})
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertBadRequestError(assert, res, 'child "name" fails because [name is required]. child "password" fails because [password is required]. child "emailAddress" fails because [emailAddress is required]')
  await server.stop()
  assert.end()
})

Test('return error if name contains spaces', async function (assert) {
  let req = Base.buildRequest({url: '/participants', method: 'POST', payload: {name: 'this contains spaces'}})
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertBadRequestError(assert, res, 'child "name" fails because [name must only contain alpha-numeric characters]. child "password" fails because [password is required]. child "emailAddress" fails because [emailAddress is required]')
  await server.stop()
  assert.end()
})

Test('return error if name is not a token', async function (assert) {
  let req = Base.buildRequest({url: '/participants/some%20bad%20name', method: 'GET'})
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertInvalidUriParameterError(assert, res, 'child "name" fails because [name must only contain alpha-numeric characters]')
  await server.stop()
  assert.end()
})
