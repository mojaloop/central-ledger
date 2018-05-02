'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('GET /auth_token', getTest => {
  getTest.test('should return token', async function (test) {
    const participantName = Fixtures.generateParticipantName()
    const password = '1234'

    await Base.createParticipant(participantName, password)
    const basicAuth = await Base.basicAuth(participantName, password)
    const res = await Base.getApi('/auth_token', basicAuth)
    const token = res.body.token
    test.ok(token)
    test.ok(token.length > 74)
    test.notEqual(token, password)
    test.end()
  })

  getTest.end()
})
