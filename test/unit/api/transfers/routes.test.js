'use strict'

const Test = require('tape')
const Base = require('../../base')

Test('return error if required field missing on prepare', async function (assert) {
  let req = Base.buildRequest({url: '/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204', method: 'PUT', payload: {}})
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertBadRequestError(assert, res, 'child "id" fails because [id is required]. child "ledger" fails because [ledger is required]. child "debits" fails because [debits is required]. child "credits" fails because [credits is required]')
  await server.stop()
  assert.end()
})

Test('return error if id is not a guid on prepare', async function (assert) {
  let req = Base.buildRequest({url: '/transfers/abcd', method: 'PUT'})
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertInvalidUriParameterError(assert, res, 'child "id" fails because [id must be a valid GUID]')
  await server.stop()
  assert.end()
})

Test('return error if id is not a guid on get prepare', async function (assert) {
  let req = Base.buildRequest({url: '/transfers/abcd', method: 'GET'})
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertInvalidUriParameterError(assert, res, 'child "id" fails because [id must be a valid GUID]')
  await server.stop()
  assert.end()
})

Test('return error if invalid content type on fulfilment', async function (assert) {
  let req = Base.buildRequest({
    url: '/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204/fulfilment',
    method: 'PUT',
    headers: {'Content-Type': 'application/json'}
  })
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertBadRequestError(assert, res, 'child "content-type" fails because [content-type must be one of [text/plain]]')
  await server.stop()
  assert.end()
})

Test('return error if fulfilment missing', async function (assert) {
  let req = Base.buildRequest({
    url: '/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204/fulfilment',
    method: 'PUT',
    headers: {'Content-Type': 'text/plain'}
  })
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertBadRequestError(assert, res, 'undefined is not allowed to be empty')
  await server.stop()
  assert.end()
})

Test('return error if id is not a guid on fulfil', async function (assert) {
  let req = Base.buildRequest({
    url: '/transfers/abcd/fulfilment',
    method: 'PUT',
    headers: {'Content-Type': 'text/plain'}
  })
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertBadRequestError(assert, res, 'child "id" fails because [id must be a valid GUID]')
  await server.stop()
  assert.end()
})

Test('return error if id is not a guid on rejection', async function (assert) {
  let req = Base.buildRequest({url: '/transfers/abcd/rejection', method: 'PUT'})
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertInvalidUriParameterError(assert, res, 'child "id" fails because [id must be a valid GUID]')
  await server.stop()
  assert.end()
})

Test('return error if rejection reason missing', async function (assert) {
  let req = Base.buildRequest({url: '/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204/rejection', method: 'PUT'})
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertBadRequestError(assert, res, 'undefined must be an object')
  await server.stop()
  assert.end()
})

Test('return error if id is not a guid on get fulfilment', async function (assert) {
  let req = Base.buildRequest({
    url: '/transfers/abcd/fulfilment',
    method: 'GET',
    headers: {'Content-Type': 'text/plain'}
  })
  const server = await Base.setup()
  const res = await server.inject(req)
  Base.assertBadRequestError(assert, res, 'child "id" fails because [id must be a valid GUID]')
  await server.stop()
  assert.end()
})
