'use strict'

const Test = require('tape')
const Base = require('../../base')

Test('return error if required field missing', assert => {
  let req = Base.buildRequest({ url: '/accounts', method: 'POST', payload: {} })

  Base.setup().then(server => {
    server.inject(req, res => {
      Base.assertBadRequestError(assert, res, [{ message: 'name is required', params: { key: 'name' } }, { message: 'password is required', params: { key: 'password' } }])
      assert.end()
    })
  })
})

Test('return error if name is not a token', assert => {
  let req = Base.buildRequest({ url: '/accounts', method: 'POST', payload: { name: 'this contains spaces' } })

  Base.setup().then(server => {
    server.inject(req, res => {
      Base.assertBadRequestError(assert, res, [{ message: 'name must only contain alpha-numeric and underscore characters', params: { key: 'name', value: 'this contains spaces' } }, { message: 'password is required', params: { key: 'password' } }])
      assert.end()
    })
  })
})

Test('return error if name is not a token', assert => {
  let req = Base.buildRequest({ url: '/accounts/some%20bad%20name', method: 'GET' })

  Base.setup().then(server => {
    server.inject(req, res => {
      Base.assertInvalidUriParameterError(assert, res, [{ message: 'name must only contain alpha-numeric and underscore characters', params: { key: 'name', value: 'some bad name' } }])
      assert.end()
    })
  })
})
