/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 * Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------
 ******/

const testData = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 1000,
    number: 2,
    fundsIn: 10000
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 1000
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testFxData = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      },
      fx: {
        targetAmount: {
          currency: 'XXX',
          amount: 50
        }
      }
    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 1000,
    number: 1,
    fundsIn: 10000
  },
  payee: {
    name: 'payeeFsp',
    number: 1,
    limit: 1000
  },
  fxp: {
    name: 'testFxp',
    number: 1,
    limit: 1000
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testDataLimitExceeded = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 1, // Limit set low
    number: 1,
    fundsIn: 10000
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 0
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testDataLimitNoLiquidity = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 10000,
    number: 1,
    fundsIn: 1 // Low liquidity
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 0
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testDataMixedWithLimitExceeded = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5000
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 6
      }
    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 1000,
    number: 1,
    fundsIn: 10000
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 1000
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testDataWithMixedCurrencies = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 2
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 3
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 4
      }

    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }

    },
    {
      amount: {
        currency: 'USD',
        amount: 6
      }

    },
    {
      amount: {
        currency: 'XXX',
        amount: 7
      }

    },
    {
      amount: {
        currency: 'USD',
        amount: 8
      }

    },
    {
      amount: {
        currency: 'XXX',
        amount: 9
      }

    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 1000,
    number: 1,
    fundsIn: 10000
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 1000
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

module.exports = {
  testData,
  testFxData,
  testDataLimitExceeded,
  testDataLimitNoLiquidity,
  testDataMixedWithLimitExceeded,
  testDataWithMixedCurrencies
}
