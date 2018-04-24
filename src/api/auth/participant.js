'use strict'

const Config = require('../../lib/config')
const ParticipantService = require('../../domain/participant')

/*
const validates = (request, name, password, cb) => {
  if (!password) {
    return cb(null, false)
  }
  if (Config.ADMIN_KEY && Config.ADMIN_SECRET && name === Config.ADMIN_KEY && password === Config.ADMIN_SECRET) {
    return cb(null, true, {name: Config.ADMIN_KEY, is_admin: true})
  }
  return ParticipantService.verify(name, password)
    .then(participant => cb(null, true, participant))
    .catch(e => {
      Logger.error(e)
      return cb(null, false)
    })
}
*/

const validate = async (request, name, password, h) => {
  if (!password) {
    return {credentials: null, isValid: false}
  }
  if (Config.ADMIN_KEY && Config.ADMIN_SECRET && name === Config.ADMIN_KEY && password === Config.ADMIN_SECRET) {
    return {credentials: {is_admin: true, name}, isValid: true}
  }
  const participant = await ParticipantService.verify(name, password)
  if (participant) {
    return {credentials: participant, isValid: true}
  } else {
    return {credentials: null, isValid: false}
  }
}

module.exports = {
  name: 'participant',
  scheme: 'simple',
  validate
}
