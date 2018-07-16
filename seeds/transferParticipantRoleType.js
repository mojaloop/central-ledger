'use strict'

const transferParticipantRoleTypes = [
  {
    'name': 'PAYER_DFSP',
    'description': 'The participant is the Payer DFSP in this transfer and is sending the funds'
  },
  {
    'name': 'PAYEE_DFSP',
    'description': 'The participant is the Payee DFSP in this transfer and is receiving the funds'
  },
  {
    'name': 'HUB',
    'description': 'The participant is representing the Hub Operator'
  }
]

exports.seed = async function (knex, Promise) {
  try {
    return await knex('transferParticipantRoleType').insert(transferParticipantRoleTypes)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return
    else console.log(`Uploading seeds for transferParticipantRoleType has failed with the following error: ${err}`)
  }
}
