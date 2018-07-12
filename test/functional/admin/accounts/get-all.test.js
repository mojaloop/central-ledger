'use strict'

const Test = require('tape')
const Logger = require('@mojaloop/central-services-shared').Logger
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('GET /participants', getTest => {
  getTest.test('should return all participants', async function (assert) {
    const participant1Name = 'a' + Fixtures.generateParticipantName()
    const participant2Name = 'b' + Fixtures.generateParticipantName()
    try {
      const participant1Res = await Base.createParticipant(participant1Name)
      const participant2Res = await Base.createParticipant(participant2Name)
      const res = await Base.getAdmin('/participants')
      assert.equal(res.body[0].name, participant1Res.body.name)
      assert.equal(res.body[0].created, participant1Res.body.created)
      assert.equal(res.body[0].id, participant1Res.body.id)
      assert.equal(res.body[0].emailAddress, participant1Res.body.emailAddress)
      assert.equal(res.body[1].name, participant2Res.body.name)
      assert.equal(res.body[1].created, participant2Res.body.created)
      assert.equal(res.body[1].id, participant2Res.body.id)
      assert.equal(res.body[1].emailAddress, participant2Res.body.emailAddress)
      assert.end()
    } catch (e) {
      Logger.info(e)
    }
  })

  getTest.end()
})
