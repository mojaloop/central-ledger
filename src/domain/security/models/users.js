'use strict'

const Uuid = require('uuid4')
const Db = require('../../../db')

const getAll = () => Db.users.find({})

const getById = (userId) => Db.users.findOne({ userId })

const getByKey = (key) => Db.users.findOne({ key })

const remove = (userId) => Db.users.destroy({ userId })

const save = (user) => {
  if (!user.userId) {
    user.userId = Uuid()
    return Db.users.insert(user)
  } else {
    return Db.users.update({ userId: user.userId }, user)
  }
}

module.exports = {
  getAll,
  getById,
  getByKey,
  remove,
  save
}
