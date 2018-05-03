'use strict'

const transferStates = [
  {
    'transferStateId': 'PENDING',
    'enumeration': 'RECEIVED',
    'description': 'Ledger has received the transfer request'
  },
  {
    'transferStateId': 'ACCEPTED',
    'enumeration': 'RECEIVED',
    'description': 'Ledger has validated the  transfer request and passed all validations'
  },
  {
    'transferStateId': 'RECEIVED',
    'enumeration': 'RECEIVED',
    'description': 'Next ledger has received the transfer.'
  },
  {
    'transferStateId': 'RESERVED',
    'enumeration': 'RESERVED',
    'description': 'Next ledger has reserved the transfer.'
  },
  {
    'transferStateId': 'COMMITTED',
    'enumeration': 'COMMITTED',
    'description': 'Next ledger has successfully performed the transfer.'
  },
  {
    'transferStateId': 'ABORTED',
    'enumeration': 'ABORTED',
    'description': 'Next ledger has aborted the transfer due a rejection or failure to perform the transfer.'
  },
  {
    'transferStateId': 'SETTLED',
    'enumeration': 'COMMITTED',
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
