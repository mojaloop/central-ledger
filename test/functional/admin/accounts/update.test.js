'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('PUT /participant/:name', putTest => {
  putTest.test('should update an participant', test => {
    let participantName = Fixtures.generateParticipantName()
    let isDisabled = true

    Base.createParticipant(participantName)
      .expect(201)
      .then((participantRes) => {
        Base.updateParticipant(participantName, isDisabled)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.name, participantRes.body.name)
            test.equal(res.body.id, participantRes.body.id)
            test.equal(res.body.created, participantRes.body.created)
            test.equal(res.body.is_disabled, isDisabled)
            test.equal(res.body.emailAddress, participantRes.body.emailAddress)
            test.end()
          })
      })
  })

  putTest.end()
})
