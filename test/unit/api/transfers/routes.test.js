'use strict'

const Test = require('tape')
const Base = require('../../base')

Test('return error if required field missing on prepare', function (assert) {
  let req = Base.buildRequest({ url: '/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204', method: 'PUT', payload: {} })

  Base.setup().then(server => {
    server.inject(req, function (res) {
      Base.assertBadRequestError(assert, res, [{ message: 'id is required', params: { key: 'id' } }, { message: 'ledger is required', params: { key: 'ledger' } }, { message: 'debits is required', params: { key: 'debits' } }, { message: 'credits is required', params: { key: 'credits' } }])
      assert.end()
    })
  })
})

Test('return error if id is not a guid on prepare', function (assert) {
  let req = Base.buildRequest({ url: '/transfers/abcd', method: 'PUT' })

  Base.setup().then(server => {
    server.inject(req, function (res) {
      Base.assertInvalidUriParameterError(assert, res, [{ message: 'id must be a valid GUID', params: { key: 'id', value: 'abcd' } }])
      assert.end()
    })
  })
})

Test('return error if id is not a guid on get prepare', function (assert) {
  let req = Base.buildRequest({ url: '/transfers/abcd', method: 'GET' })

  Base.setup().then(server => {
    server.inject(req, function (res) {
      Base.assertInvalidUriParameterError(assert, res, [{ message: 'id must be a valid GUID', params: { key: 'id', value: 'abcd' } }])
      assert.end()
    })
  })
})

Test('return error if invalid content type on fulfillment', function (assert) {
  let req = Base.buildRequest({ url: '/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204/fulfillment', method: 'PUT', headers: { 'Content-Type': 'application/json' } })

  Base.setup().then(server => {
    server.inject(req, function (res) {
      Base.assertInvalidHeaderError(assert, res, [{ message: 'content-type must be one of [text/plain]', params: { key: 'content-type', valids: ['text/plain'] } }])
      assert.end()
    })
  })
})

Test('return error if fulfillment missing', function (assert) {
  let req = Base.buildRequest({ url: '/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204/fulfillment', method: 'PUT', headers: { 'Content-Type': 'text/plain' } })

  Base.setup().then(server => {
    server.inject(req, function (res) {
      Base.assertBadRequestError(assert, res, [{ message: 'value is not allowed to be empty', params: { key: 'value' } }])
      assert.end()
    })
  })
})

Test('return error if id is not a guid on fulfill', function (assert) {
  let req = Base.buildRequest({ url: '/transfers/abcd/fulfillment', method: 'PUT', headers: { 'Content-Type': 'text/plain' } })

  Base.setup().then(server => {
    server.inject(req, function (res) {
      Base.assertInvalidUriParameterError(assert, res, [{ message: 'id must be a valid GUID', params: { key: 'id', value: 'abcd' } }])
      assert.end()
    })
  })
})

Test('return error if id is not a guid on rejection', function (assert) {
  let req = Base.buildRequest({ url: '/transfers/abcd/rejection', method: 'PUT' })

  Base.setup().then(server => {
    server.inject(req, function (res) {
      Base.assertInvalidUriParameterError(assert, res, [{ message: 'id must be a valid GUID', params: { key: 'id', value: 'abcd' } }])
      assert.end()
    })
  })
})

Test('return error if rejection reason missing', function (assert) {
  let req = Base.buildRequest({ url: '/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204/rejection', method: 'PUT' })
  Base.setup().then(server => {
    server.inject(req, function (res) {
      Base.assertBadRequestError(assert, res, [{ message: 'value must be an object', params: { key: 'value' } }])
      assert.end()
    })
  })
})

Test('return error if id is not a guid on get fulfillment', function (assert) {
  let req = Base.buildRequest({ url: '/transfers/abcd/fulfillment', method: 'GET', headers: { 'Content-Type': 'text/plain' } })

  Base.setup().then(server => {
    server.inject(req, function (res) {
      Base.assertInvalidUriParameterError(assert, res, [{ message: 'id must be a valid GUID', params: { key: 'id', value: 'abcd' } }])
      assert.end()
    })
  })
})
