'use strict'

const PositionService = require('../../domain/position')
const Participant = require('../../domain/participant')

exports.calculateForAllParticipants = async function (request, h) {
  const positions = await PositionService.calculateForAllParticipants()
  return h.response({positions: positions})
}

exports.calculateForParticipant = async function (request, h) {
  const participant = await Participant.getByName(request.params.name)
  return await PositionService.calculateForParticipant(participant)
}
