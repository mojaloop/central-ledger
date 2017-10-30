'use strict'

const Test = require('tapes')(require('tape'))
const Permissions = require('../../../../src/domain/security/permissions')
const Handler = require('../../../../src/admin/permissions/handler')

Test('Permissions handler', handlerTest => {
  handlerTest.test('getPermissions should', permissionsTest => {
    permissionsTest.test('return defined permissions', test => {
      const reply = (response) => {
        test.deepEqual(response, Object.keys(Permissions).map(x => Permissions[x]))
        test.end()
      }

      Handler.getPermissions({}, reply)
    })
    permissionsTest.end()
  })

  handlerTest.end()
})
