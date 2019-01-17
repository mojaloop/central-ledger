'use strict'

const Test = require('tapes')(require('tape'))
const Handler = require('../../../../src/admin/routing/handler')

Test('routing', routeTest => {
  routeTest.test('getNextHop returns finalDestination and destination', async function (assert) {
    const params = {
      'fspiop-destination': 'moja.tz.red.tz.pink'
    }

    const response = await Handler.getNextHop({ headers: params })
    assert.deepEqual(response, {
      finalDestination: 'moja.tz.red.tz.pink',
      destination: 'moja.superremit'
    })
    assert.end()
  })

  routeTest.end()
})
