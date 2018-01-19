'use strict'

const PositionService = require('../../domain/position')
const Account = require('../../domain/account')

exports.calculateForAllAccounts = (request, reply) => {
  PositionService.calculateForAllAccounts()
        .then(positions => reply({ positions: positions }))
}

exports.calculateForAccount = (request, reply) => {
  return Account.getByName(request.params.name).then(account => {
    return PositionService.calculateForAccount(account)
            .then(position => reply(position))
  })
}
