'use strict'

const endpointTypes = [
  {
    'name': 'FSIOP_CALLBACK_URL',
    'description': 'Mojaloop compliant callback URL'
  },
  {
    'name': 'ALARM_NOTIFICATION_URL',
    'description': 'Participant callback URL to which alarm notifications can be sent'
  },
  {
    'name': 'ALARM_NOTIFICATION_TOPIC',
    'description': 'Kafka topic used to publish alarm notifications'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('endpointType').insert(endpointTypes)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for endpointType has failed with the following error: ${err}`)
      return -1000
    }
  }
}
