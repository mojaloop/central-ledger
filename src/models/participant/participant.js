
'use strict'

const Db = require('../../db')

exports.getById = async (id) => {
  try {
    return await Db.participant.findOne({ participantId: id })
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.getByName = async (name) => {
  try {
    const named = await Db.participant.findOne({ name })
    return named
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.getAll = async () => {
  try {
    const participants = await Db.participant.find({}, { order: 'name asc' })
    return participants
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.create = async (participant) => {
  try {
    let result = await Db.participant.insert({
      name: participant.name,
      createdBy: 'unknown'
    })
    return result
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.update = async (participant, isActive) => {
  try {
    return await Db.participant.update({ participantId: participant.participantId }, { isActive })
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.destroyByName = async (participant) => {
  try {
    return await Db.participant.destroy({name: participant.name})
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.addEndpoint = async (participant, endpoint) => {
  try {
    return Db._knex.transaction(async function (trx) {
      let endpointType = await trx.first('endpointTypeId').from('endpointType').where('name', endpoint.type).andWhere('isActive', 1)
      let existingEndpoint =  await trx.first('*').from('participantEndpoint')
      .where('participantId', participant.participantId)
      .andWhere('endpointTypeId', endpointType.endpointTypeId)
      .andWhere('isActive', 1) 
      
      if(existingEndpoint){
        existingEndpoint.isActive = 0
        await trx.where('participantEndpointId', existingEndpoint.participantEndpointId).update(existingEndpoint).into('participantEndpoint')
      }
      let newEndpoint = {
        participantId: participant.participantId,
        endpointTypeId: endpointType.endpointTypeId,
        value: endpoint.value,
        isActive: 1,
        createdBy: 'unknown'
      }
      return trx.insert(newEndpoint).into('participantEndpoint')
    })

  } catch (err) {
    throw new Error(err.message)
  }
}

exports.getEndpoint = async (participant, endpointType) => {
  try {
    return await Db.participantEndpoint.query( builder =>{ 
      return builder.innerJoin('endpointType AS et', 'participantEndpoint.endpointTypeId', 'et.endpointTypeId')
      .andWhere('participantEndpoint.participantId', participant.participantId)
      .andWhere('participantEndpoint.isActive', 1)
      .andWhere('et.name', endpointType).select('participantEndpoint.participantEndpointId', 
      'participantEndpoint.participantId', 
      'participantEndpoint.endpointTypeId', 
      'participantEndpoint.value', 
      'participantEndpoint.isActive', 
      'participantEndpoint.createdDate', 
      'participantEndpoint.createdBy', 
      'et.name')
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.getAllEndpoints = async (participant) => {
  try {
    return await Db.participantEndpoint.query( builder =>{ 
      return builder.innerJoin('endpointType AS et', 'participantEndpoint.endpointTypeId', 'et.endpointTypeId')
      .andWhere('participantEndpoint.participantId', participant.participantId)
      .andWhere('participantEndpoint.isActive', 1).select('participantEndpoint.participantEndpointId', 
      'participantEndpoint.participantId', 
      'participantEndpoint.endpointTypeId', 
      'participantEndpoint.value', 
      'participantEndpoint.isActive', 
      'participantEndpoint.createdDate', 
      'participantEndpoint.createdBy', 
      'et.name')
    })
  } catch (err) {
    throw new Error(err.message)
  }
}