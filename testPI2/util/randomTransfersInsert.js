const RandomTransfers = require('./randomTransfers')

const config = {
  debug: 5000, // how often to output progress
  totalCount: 1000000, // total number of transfers to be inserted
  expiredCount: 1000, // target number of randomly distributed expired transfers
  amount: [1, 100], // transfer amount range
  currencyList: ['USD', 'EUR', 'ZAR'], // transfer currencies list
  hoursDiff: [24, 168] // hours difference from current datetime of all transfers
}

RandomTransfers.insert(config)
