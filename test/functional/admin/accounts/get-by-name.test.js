'use strict'

const Test = require('tape')
const bluebird = require('bluebird')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('GET /participants', getTest => {
  getTest.test('should return all participants', function (assert) {
    const participant1Name = 'a' + Fixtures.generateParticipantName()
    const participant2Name = 'b' + Fixtures.generateParticipantName()

    bluebird.all([Base.createParticipant(participant1Name), Base.createParticipant(participant2Name)])
      .then(([participant1Res, participant2Res]) => {
        Base.getAdmin(`/participants/${participant1Name}`)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            assert.equal(res.body.name, participant1Res.body.name)
            assert.equal(res.body.created, participant1Res.body.created)
            assert.equal(res.body.id, participant1Res.body.id)
            assert.equal(res.body.emailAddress, participant1Res.body.emailAddress)
            assert.end()
          })
      })
  })

  getTest.end()
})
