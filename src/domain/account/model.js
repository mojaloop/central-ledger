'use strict'

const Db = require('../../db')

exports.getById = (id) => {
  return Db.accounts.findOne({ accountId: id })
}

exports.getByName = (name) => {
  return Db.accounts.findOne({ name })
}

exports.retrievePartyCredentials = (account) => {
  return Db.userCredentials.findOne({ accountId: account.accountId })
}

exports.getAll = () => {
  return Db.accounts.find({}, { order: 'name asc' })
}

exports.update = (account, isDisabled) => {
  return Db.accounts.update({ accountId: account.accountId }, { isDisabled })
}

exports.updatePartyCredentials = (account, hashedPassword) => {
  return Db.userCredentials.update({ accountId: account.accountId }, { password: hashedPassword })
}

exports.updateAccountSettlement = (account, settlement) => {
  return Db.accountsSettlement.findOne({ accountId: account.accountId })
    .then(accountSettlement => {
      if (accountSettlement) {
        return Db.accountsSettlement.update({ accountId: account.accountId }, { accountNumber: settlement.account_number, routingNumber: settlement.routing_number }).then(updatedSettlement => {
          return {
            accountName: account.name,
            accountNumber: updatedSettlement.accountNumber,
            routingNumber: updatedSettlement.routingNumber
          }
        })
      }
      return Db.accountsSettlement.insert({ accountId: account.accountId, accountNumber: settlement.account_number, routingNumber: settlement.routing_number }).then(insertedSettlement => {
        return {
          accountName: account.name,
          accountNumber: insertedSettlement.accountNumber,
          routingNumber: insertedSettlement.routingNumber
        }
      })
    })
}

exports.create = (account) => {
  return Db.accounts.insert({ name: account.name, emailAddress: account.emailAddress })
  .then(insertedAccount => {
    const newaccount = Db.accounts.findOne({ accountId: insertedAccount })
    return Db.userCredentials.insert({ accountId: insertedAccount, password: account.hashedPassword })
      .then(() => newaccount)
  })
}
