'use strict'

const transferStates = [
  {
    'transferStateId': 'PENDING',
    'description': 'Ledger has received the transfer request'
  },
  {
    'transferStateId': 'ACCEPTED',
    'description': 'Ledger has validated the  transfer request and passed all validations'
  },
  {
    'transferStateId': 'RECEIVED',
    'description': 'Next ledger has received the transfer.'
  },
  {
    'transferStateId': 'RESERVED',
    'description': 'Next ledger has reserved the transfer.'
  },
  {
    'transferStateId': 'COMMITTED',
    'description': 'Next ledger has successfully performed the transfer.'
  },
  {
    'transferStateId': 'ABORTED',
    'description': 'Next ledger has aborted the transfer due a rejection or failure to perform the transfer.'
  },
  {
    'transferStateId': 'SETTLED',
    'description': 'Ledger has settled the transfer'
  }
]

exports.seed = async function (knex, Promise) {
  try {
    return await knex('transferState').insert(transferStates)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return
    else console.log(`Uploading seeds for transferState has failed with the following error: ${err}`)
  }
}
