'use strict'

const Test = require('tapes')(require('tape'))
// const Config = require('../../../../src/lib/config')
const Handler = require('../../../../src/handlers/api/routes')
// const apiTags = ['api']

function createRequest (routes) {
  let value = routes || []
  return {
    server: {
      table: () => {
        return [{ table: value }]
      }
    }
  }
}

Test('route handler', (handlerTest) => {
  handlerTest.beforeEach(t => {
    t.end()
  })

  handlerTest.afterEach(t => {
    t.end()
  })

  handlerTest.test('health should', (healthTest) => {
    healthTest.test('return status ok', async function (assert) {
      let reply = {
        response: (response) => {
          assert.equal(response.status, 'OK')
          return {
            code: (statusCode) => {
              assert.equal(statusCode, 200)
              assert.end()
            }
          }
        }
      }

      var jp = require('jsonpath')
      var healthHandler = jp.query(Handler, '$[?(@.path=="/health")]')
      if (Array.isArray(healthHandler) && healthHandler.length === 1) {
        healthHandler[0].handler(createRequest(), reply)
      } else {
        assert.fail('No health status handler found')
        assert.end()
      }
    })
    healthTest.end()
  })

  handlerTest.end()
})
