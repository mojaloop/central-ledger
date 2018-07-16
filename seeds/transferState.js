'use strict'

const transferStates = [
  {
    'transferStateId': 'RECEIVED_PREPARE',
    'enumeration': 'RECEIVED',
    'description': 'Next ledger has received the transfer.'
  },
  {
    'transferStateId': 'RESERVED',
    'enumeration': 'RESERVED',
    'description': 'Next ledger has reserved the transfer.'
  },
  {
    'transferStateId': 'RECEIVED_FULFIL',
    'enumeration': 'RESERVED',
    'description': 'Next ledger has reserved the transfer, and has beenn assigned to a settlement window'
  },
  {
    'transferStateId': 'COMMITTED',
    'enumeration': 'COMMITTED',
    'description': 'Next ledger has successfully performed the transfer.'
  },
  {
    'transferStateId': 'FAILED',
    'enumeration': 'ABORTED',
    'description': 'Aborted the transfer due to failure to perform the transfer.'
  },
  {
    'transferStateId': 'EXPIRED',
    'enumeration': 'ABORTED',
    'description': 'Aborted the transfer due to expiration.'
  },
  {
    'transferStateId': 'REJECTED',
    'enumeration': 'ABORTED',
    'description': 'Next ledger has aborted the transfer due a rejection or failure to perform the transfer.'
  },
  {
    'transferStateId': 'PENDING_SETTLEMENT',
    'enumeration': 'COMMITTED',
    'description': 'Ledger has scheduled transfer for settlement'
  },
  {
    'transferStateId': 'SETTLED',
    'enumeration': 'SETTLED',
    'description': 'Ledger has settled the transfer'
  },
  {
    'transferStateId': 'ABORTED',
    'enumeration': 'ABORTED',
    'description': 'Next ledger has aborted the transfer due to being FAILED, EXPIRED or REJECTED'
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
