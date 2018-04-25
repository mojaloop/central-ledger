'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('return metadata', async function (assert) {
  const res = await Base.getApi('/')
  assert.equal(res.body.currency_code, null)
  assert.equal(res.body.currency_symbol, null)
  assert.equal(res.body.precision, 10)
  assert.equal(res.body.scale, 2)
  assert.deepEqual(res.body.connectors, [])
  assert.equal(Object.keys(res.body.urls).length, 14)
  assert.equal(res.body.urls.health, `http://${Fixtures.hostname}/health`)
  assert.equal(res.body.urls.participant, `http://${Fixtures.hostname}/participants/:name`)
  assert.equal(res.body.urls.participant_update_user_credentials, `http://${Fixtures.hostname}/participants/:name`)
  assert.equal(res.body.urls.participant_update_participant_settlement, `http://${Fixtures.hostname}/participants/:name/settlement`)
  assert.equal(res.body.urls.participants, `http://${Fixtures.hostname}/participants`)
  assert.equal(res.body.urls.transfer, `http://${Fixtures.hostname}/transfers/:id`)
  assert.equal(res.body.urls.transfer_fulfillment, `http://${Fixtures.hostname}/transfers/:id/fulfillment`)
  assert.equal(res.body.urls.transfer_rejection, `http://${Fixtures.hostname}/transfers/:id/rejection`)
  assert.equal(res.body.urls.websocket, `ws://${Fixtures.hostname}/websocket`)
  assert.equal(res.body.urls.message, `http://${Fixtures.hostname}/messages`)
  assert.equal(res.body.urls.charge, `http://${Fixtures.hostname}/charge/quote`)
  assert.equal(res.body.urls.positions, `http://${Fixtures.hostname}/positions`)
  assert.equal(res.body.urls.positions_participant, `http://${Fixtures.hostname}/positions/:name`)
  assert.equal(res.body.urls.auth_token, `http://${Fixtures.hostname}/auth_token`)
  assert.end()
})

Test('return api documentation', function (assert) {
  Base.getApi('/documentation')
    .expect(200)
    .expect('Content-Type', /html/)
    .then(res => {
      assert.end()
    })
})

Test('return health', function (assert) {
  Base.getApi('/health')
    .expect(200)
    .expect('Content-Type', /json/)
    .then(res => {
      assert.equal(res.body.status, 'OK')
      assert.end()
    })
})
