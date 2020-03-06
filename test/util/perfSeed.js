var request = require('request');
var uuid = require('uuid');

/* CONFIG for a run */
const centralLedgerURL = 'http://localhost:3001'
const fspMaxIdx = 80

const FspAdd = async (fspName) => {
  const addFspURL = `${centralLedgerURL}/participants`
  console.log(`FspAdd: Hitting ${addFspURL}`)
  return new Promise((resolve, reject) =>
    request.post(
      addFspURL,
      {
          headers: {
              'Content-Type': 'application/json'
          },
          json: {
              "name": fspName,
              "currency": 'USD'
          }
      },
      (error, response, body) => {
        if (response.statusCode === 201) {
          resolve()
        } else if (response.statusCode === 400) {
          console.log(`FspAdd: ${fspName} already exists`)
          resolve()
        } else {
          console.log('FspAdd: is back with ', response.statusCode, error, body)
          reject()
        }
      }
    )
  )
}

const FspAddLimit = async (fspName) => {
  const addFspLimitURL = `${centralLedgerURL}/participants/${fspName}/initialPositionAndLimits`
  console.log(`FspAddLimit: Hitting ${addFspLimitURL}`)
  return new Promise((resolve, reject) =>
    request.post(
      addFspLimitURL,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        json: {
          currency: 'USD',
          limit: {
            type: "NET_DEBIT_CAP",
            value: 1000000
          },
          initialPosition: 0
        }
      },
      (error, response, body) => {
        if (response.statusCode === 201) {
          resolve()
        } else if (response.statusCode === 500) {
          console.log(`FspAddLimit: ${fspName} already set`)
          resolve()
        } else {
          console.log(`FspAddLimit is back with `, response.statusCode, error, body)
          reject()
        }
      }
    )
  )
}

const FspAddCallbackURL = async (fspName, theCallbackType, theCallbackURL) => {
  const addFspLimitURL = `${centralLedgerURL}/participants/${fspName}/endpoints`
  console.log(`FspAddCallbackURL: Hitting ${addFspLimitURL} with ${theCallbackType} set to ${theCallbackURL}`)
  return new Promise((resolve, reject) =>
    request.post(
      addFspLimitURL,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        json: {
          type: theCallbackType,
          value: theCallbackURL
        }
      },
      (error, response, body) => {
        if (response.statusCode === 201) {
          resolve()
        } else if (response.statusCode === 500) {
          console.log(`FspAddCallbackURL: ${fspName} already set`)
          resolve()
        } else {
          console.log(`FspAddCallbackURL is back with `, response.statusCode, error, body)
          reject()
        }
      }
    )
  )
}

const startAdding = async () => {
  for (let fspIdx = 1; fspIdx <= fspMaxIdx; fspIdx++)
  {
    const fspName = 'simfsp' + (fspIdx.toString()).padStart(2, '0')

    console.log(`Adding new FSP with name: ${fspName}`)
    await FspAdd(fspName)
    await FspAddLimit(fspName)
    await FspAddCallbackURL(fspName, 'FSPIOP_CALLBACK_URL_PARTICIPANT_PUT', `http://simulator:8444/payerfsp/participants/{{partyIdType}}/{{partyIdentifier}}`)
    await FspAddCallbackURL(fspName, 'FSPIOP_CALLBACK_URL_PARTICIPANT_PUT_ERROR', `http://simulator:8444/payerfsp/participants/{{partyIdType}}/{{partyIdentifier}}/error`)
    await FspAddCallbackURL(fspName, 'FSPIOP_CALLBACK_URL_PARTICIPANT_BATCH_PUT', `http://simulator:8444/payerfsp/participants/{{requestId}}`)
    await FspAddCallbackURL(fspName, 'FSPIOP_CALLBACK_URL_PARTICIPANT_BATCH_PUT_ERROR', `http://simulator:8444/payerfsp/participants/{{requestId}}/error`)

    await FspAddCallbackURL(fspName, 'FSPIOP_CALLBACK_URL_PARTIES_GET', `http://simulator:8444/payerfsp/parties/{{partyIdType}}/{{partyIdentifier}}`)
    await FspAddCallbackURL(fspName, 'FSPIOP_CALLBACK_URL_PARTIES_PUT', `http://simulator:8444/payerfsp/parties/{{partyIdType}}/{{partyIdentifier}}`)
    await FspAddCallbackURL(fspName, 'FSPIOP_CALLBACK_URL_PARTIES_PUT_ERROR', `http://simulator:8444/payerfsp/parties/{{partyIdType}}/{{partyIdentifier}}/error`)

    await FspAddCallbackURL(fspName, 'FSPIOP_CALLBACK_URL_QUOTES', `http://simulator:8444/payerfsp/`)
    await FspAddCallbackURL(fspName, 'FSPIOP_CALLBACK_URL_TRANSFER_POST', `http://simulator:8444/payeefsp/transfers`)
    await FspAddCallbackURL(fspName, 'FSPIOP_CALLBACK_URL_TRANSFER_PUT', `http://simulator:8444/payerfsp/transfers/{{transferId}}`)
    await FspAddCallbackURL(fspName, 'FSPIOP_CALLBACK_URL_TRANSFER_ERROR', `http://simulator:8444/payerfsp/transfers/{{transferId}}/error`)

    console.log(`...added ${fspName}`)
    console.log('')
  }
}

startAdding()

