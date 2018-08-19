'use strict'

const settlementStates = [
  {
    'settlementStateId': 'NOT_SETTLED',
    'enumeration': 'NOT_SETTLED',
    'description': 'For the particular Settlement Window, the participant was active but has not yet settled.'
  },
  {
    'settlementStateId': 'PENDING_SETTLEMENT',
    'enumeration': 'PENDING_SETTLEMENT',
    'description': 'The net settlement report for this window has been taken, with the parameter set to indicate that settlement is to be processed.'
  },
  {
    'settlementStateId': 'SETTLED',
    'enumeration': 'SETTLED',
    'description': 'The Hub Operator/Settlement Bank has confirmed that all the participants that engaged in the settlement window have now settled their payments in accordance with the net settlement report.'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('settlementState').insert(settlementStates)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for settlementState has failed with the following error: ${err}`)
      return -1000
    }
  }
}
