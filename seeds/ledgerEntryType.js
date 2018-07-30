'use strict'

const ledgerEntryTypes = [
  {
    'name': 'PRINCIPLE_VALUE',
    'description': 'The principle amount to be settled between parties, derived on quotes between DFSPs'
  },
  {
    'name': 'INTERCHANGE_FEE',
    'description': 'Fees to be paid between DFSP'
  },
  {
    'name': 'HUB_FEE',
    'description': 'Fees to be paid from the DFSPs to the Hub Operator'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('ledgerEntryType').insert(ledgerEntryTypes)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for ledgerEntryType has failed with the following error: ${err}`)
      return -1000
    }
  }
}
