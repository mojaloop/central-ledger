'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const P = require('bluebird')
const Fixtures = require('../../../fixtures')
const Model = require('../../../../src/domain/token/model')
const ParticipantModel = require('../../../../src/domain/participant/model')

const createParticipant = () => {
  const participantName = Fixtures.generateParticipantName()
  return ParticipantModel.create({ name: participantName, hashedPassword: 'password', emailAddress: participantName + '@test.com' })
}

const generateToken = ({ participantId }, expiration = null) => {
  const token = Uuid().toString()
  return Model.create({ participantId, token, expiration })
}

Test('Token Model', modelTest => {
  modelTest.test('byParticipant should', tokensByParticipantTest => {
    tokensByParticipantTest.test('return tokens for participant', test => {
      P.all([
        createParticipant(),
        createParticipant()
      ]).then(([participant1, participant2]) => {
        return P.all([
          generateToken(participant1),
          generateToken(participant2),
          generateToken(participant1)
        ]).then(([token1, token2, token3]) => {
          return Model.byParticipant(participant1).then((results) => ({ results, token1, token2, token3 }))
        })
      }).then(({ results, token1, token2, token3 }) => {
        test.equal(results.length, 2)
        test.ok(results.find(t => t.token === token1.token))
        test.ok(results.find(t => t.token === token3.token))
        test.notOk(results.find(t => t.token === token2.token))
        test.end()
      })
    })

    tokensByParticipantTest.test('return admin tokens if participantId is null', test => {
      createParticipant()
      .then(participant1 => {
        return P.all([
          generateToken(participant1),
          generateToken({})
        ]).then(([token1, token2]) => {
          return Model.byParticipant({ participantId: null }).then((results) => ({ results, token1, token2 }))
        })
      })
      .then(({ results, token1, token2 }) => {
        test.equal(results.length, 1)
        test.ok(results.find(t => t.token === token2.token))
        test.notOk(results.find(t => t.token === token1.token))
        test.end()
      })
    })

    tokensByParticipantTest.end()
  })

  modelTest.test('removeExpired should', removeExpiredTest => {
    removeExpiredTest.test('remove all expired tokens', test => {
      let futureExpiration = Fixtures.getCurrentUTCTimeInMilliseconds() + 60000
      let pastExpiration = Fixtures.getCurrentUTCTimeInMilliseconds() - 60000

      createParticipant()
      .then(participant1 => {
        return P.all([
          generateToken(participant1, futureExpiration),
          generateToken(participant1, futureExpiration),
          generateToken(participant1, pastExpiration),
          generateToken(participant1, pastExpiration)
        ])
        .then(([token1, token2, token3, token4]) => {
          return Model.byParticipant(participant1).then(results => {
            test.equal(results.length, 4)
            return Model.removeExpired().then(results => {
              test.equal(results.length, 2)
            })
          })
          .then(() => {
            return Model.byParticipant(participant1).then(results => {
              test.equal(results.length, 2)
              test.end()
            })
          })
        })
      })
    })

    removeExpiredTest.end()
  })

  modelTest.end()
})
