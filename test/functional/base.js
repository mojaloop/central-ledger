'use strict'

// const host = process.env.API_HOST_IP || 'localhost'
const apiHost = process.env.API_HOST_IP || 'localhost'
const adminHost = process.env.ADMIN_HOST_IP || 'localhost'
const RequestApi = require('supertest')('http://' + apiHost + ':3000')
const RequestAdmin = require('supertest')('http://' + adminHost + ':3001')
const P = require('bluebird')
const Encoding = require('@mojaloop/central-services-shared').Encoding
const DA = require('deasync-promise')

const participant1Name = 'dfsp1'
const participant1ParticipantNumber = '1234'
const participant1RoutingNumber = '2345'
const participant2Name = 'dfsp2'
const participant2ParticipantNumber = '3456'
const participant2RoutingNumber = '4567'

const basicAuth = (name, password) => {
  const credentials = Encoding.toBase64(name + ':' + password)
  return {'Authorization': `Basic ${credentials}`}
}

let participant1promise
let participant2promise
const participant1 = () => {
  if (!participant1promise) {
    participant1promise = createParticipant(participant1Name, participant1Name).then(res => {
      return createParticipantSettlement(participant1Name, participant1ParticipantNumber, participant1RoutingNumber).then(() => res.body)
    })
  }
  return DA(participant1promise)
}

const participant2 = () => {
  if (!participant2promise) {
    participant2promise = createParticipant(participant2Name, participant2Name).then(res => {
      return createParticipantSettlement(participant2Name, participant2ParticipantNumber, participant2RoutingNumber).then(() => res.body)
    })
  }
  return DA(participant2promise)
}

const getApi = (path, headers = {}) => RequestApi.get(path).auth('admin', 'admin').set(headers)

const postApi = (path, data, auth = {
  name: 'admin',
  password: 'admin',
  emailAddress: 'admin@test.com'
}, contentType = 'application/json') => RequestApi.post(path).auth(auth.name, auth.password, auth.emailAddress).set('Content-Type', contentType).send(data)

const putApi = (path, data, auth = {
  name: 'admin',
  password: 'admin',
  emailAddress: 'admin@test.com'
}, contentType = 'application/json') => RequestApi.put(path).auth(auth.name, auth.password, auth.emailAddress).set('Content-Type', contentType).send(data)

const getAdmin = (path, headers = {}) => RequestAdmin.get(path).set(headers)

const postAdmin = (path, data, contentType = 'application/json') => RequestAdmin.post(path).set('Content-Type', contentType).send(data)

const putAdmin = (path, data, contentType = 'application/json') => RequestAdmin.put(path).set('Content-Type', contentType).send(data)

const createParticipant = (participantName, password = '1234', emailAddress = participantName + '@test.com') => postApi('/participants', {
  name: participantName,
  password: password,
  emailAddress: emailAddress
})

const createParticipantSettlement = (participantName, participantNumber, routingNumber) => putApi(`/participants/${participantName}/settlement`, {
  participant_number: participantNumber,
  routing_number: routingNumber
})

const getParticipant = (participantName) => getApi(`/participants/${participantName}`)

const updateParticipant = (participantName, isDisabled) => putAdmin(`/participants/${participantName}`, {is_disabled: isDisabled})

const getTransfer = (transferId) => getApi(`/transfers/${transferId}`)

const getFulfillment = (transferId) => getApi(`/transfers/${transferId}/fulfilment`)

const prepareTransfer = (transferId, transfer) => P.resolve(putApi(`/transfers/${transferId}`, transfer))

const fulfillTransfer = (transferId, fulfilment, auth) => putApi(`/transfers/${transferId}/fulfilment`, fulfilment, auth, 'text/plain')

const rejectTransfer = (transferId, reason, auth) => putApi(`/transfers/${transferId}/rejection`, reason, auth)

const createCharge = (payload) => postAdmin('/charge', payload)

const updateCharge = (name, payload) => putAdmin(`/charge/${name}`, payload)

module.exports = {
  participant1Name: participant1().name,
  participant1ParticipantNumber,
  participant1RoutingNumber,
  participant1Password: participant1Name,
  participant2Name: participant2().name,
  participant2ParticipantNumber,
  participant2RoutingNumber,
  participant2Password: participant2Name,
  basicAuth,
  createParticipant,
  createCharge,
  fulfillTransfer,
  getTransfer,
  getFulfillment,
  getApi,
  getAdmin,
  getParticipant,
  postApi,
  postAdmin,
  prepareTransfer,
  putApi,
  putAdmin,
  rejectTransfer,
  updateParticipant,
  updateCharge
}
