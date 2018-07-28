'use strict'

const participantLimitTypes = [
  {
    'name': 'NET_DEBIT_CAP'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('participantLimitType').insert(participantLimitTypes)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for participantLimitType has failed with the following error: ${err}`)
      return -1000
    }
  }
}
