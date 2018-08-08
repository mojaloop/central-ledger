'use strict'

const settlementWindowStates = [
  {
    'settlementWindowStateId': 'OPEN',
    'enumeration': 'OPEN',
    'description': 'Current window into which Fulfilled transfers are being allocated. Only one window should be open at a time.'
  },
  {
    'settlementWindowStateId': 'CLOSED',
    'enumeration': 'CLOSED',
    'description': 'Settlement Window is not accepting any additional transfers. All new transfers are being allocated to the OPEN Settlement Window.'
  },
  {
    'settlementWindowStateId': 'PENDING_SETTLEMENT',
    'enumeration': 'PENDING_SETTLEMENT',
    'description': 'The net settlement report for this window has been taken, with the parameter set to indicate that settlement is to be processed.'
  },
  {
    'settlementWindowStateId': 'SETTLED',
    'enumeration': 'SETTLED',
    'description': 'The Hub Operator/Settlement Bank has confirmed that all the participants that engaged in the settlement window have now settled their payments in accordance with the net settlement report.'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('settlementWindowState').insert(settlementWindowStates)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for settlementWindowState has failed with the following error: ${err}`)
      return -1000
    }
  }
}
