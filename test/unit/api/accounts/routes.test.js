'use strict'

const Test = require('tape')
const Base = require('../../base')

Test('return error if required field missing', async function (assert) {
  let req = Base.buildRequest({url: '/accounts', method: 'POST', payload: {}})
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertBadRequestError(assert, res, [{
    message: 'name is required',
    params: {key: 'name'}
  }, {message: 'password is required', params: {key: 'password'}}, {
    message: 'email is required',
    params: {key: 'email'}
  }])
  server.stop()
  assert.end()
})

Test('return error if name is not a token', async function (assert) {
  let req = Base.buildRequest({url: '/accounts', method: 'POST', payload: {name: 'this contains spaces'}})
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertBadRequestError(assert, res, [{
    message: 'name must only contain alpha-numeric and underscore characters',
    params: {key: 'name', value: 'this contains spaces'}
  }, {message: 'password is required', params: {key: 'password'}}])
  server.stop()
  assert.end()
})

Test('return error if name is not a token', assert => {
  let req = Base.buildRequest({url: '/accounts/some%20bad%20name', method: 'GET'})

  Base.setup().then(server => {
    server.inject(req, res => {
      Base.assertInvalidUriParameterError(assert, res, [{
        message: 'name must only contain alpha-numeric and underscore characters',
        params: {key: 'name', value: 'some bad name'}
      }])
      assert.end()
    })
  })
})
