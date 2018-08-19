'use strict'

const transferStates = [
  {
    'transferStateId': 'RECEIVED_PREPARE',
    'enumeration': 'RECEIVED',
    'description': 'The switch has received the transfer.'
  },
  {
    'transferStateId': 'RESERVED',
    'enumeration': 'RESERVED',
    'description': 'The switch has reserved the transfer.'
  },
  {
    'transferStateId': 'RECEIVED_FULFIL',
    'enumeration': 'RESERVED',
    'description': 'The switch has reserved the transfer, and has been assigned to a settlement window.'
  },
  {
    'transferStateId': 'COMMITTED',
    'enumeration': 'COMMITTED',
    'description': 'The switch has successfully performed the transfer.'
  },
  {
    'transferStateId': 'FAILED',
    'enumeration': 'ABORTED',
    'description': 'Aborted the transfer due to failure to perform the transfer.'
  },
  {
    'transferStateId': 'RESERVED_TIMEOUT',
    'enumeration': 'RESERVED',
    'description': 'Expiring the transfer and returning funds to payer fsp.'
  },
  {
    'transferStateId': 'REJECTED',
    'enumeration': 'RESERVED',
    'description': 'The switch has aborted the transfer due a rejection from payee fsp.'
  },
  {
    'transferStateId': 'ABORTED',
    'enumeration': 'ABORTED',
    'description': 'The switch has aborted the transfer due to being FAILED or REJECTED.'
  },
  {
    'transferStateId': 'EXPIRED_PREPARED',
    'enumeration': 'ABORTED',
    'description': 'The switch has aborted the transfer due to being EXPIRED transfer from RECEIVED_PREPARE.'
  },
  {
    'transferStateId': 'EXPIRED_RESERVED',
    'enumeration': 'ABORTED',
    'description': 'The switch has aborted the transfer due to being EXPIRED transfer from RESERVED.'
  },
  {
    'transferStateId': 'INVALID',
    'enumeration': 'ABORTED',
    'description': 'The switch has aborted the transfer due to validation failure.'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('transferState').insert(transferStates)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for transferState has failed with the following error: ${err}`)
      return -1000
    }
  }
}
