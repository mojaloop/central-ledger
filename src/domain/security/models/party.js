'use strict'

const Uuid = require('uuid4')
const Db = require('../../../db')

const getAll = () => Db.party.find({})

const getById = (partyId) => Db.party.findOne({ partyId })

const getByKey = (key) => Db.party.findOne({ key })

const remove = (partyId) => Db.party.destroy({ partyId })

const save = (party) => {
  if (!party.partyId) {
    party.partyId = Uuid()
    return Db.party.insert(party)
  } else {
    return Db.party.update({ partyId: party.partyId }, party)
  }
}

module.exports = {
  getAll,
  getById,
  getByKey,
  remove,
  save
}
