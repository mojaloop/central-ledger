'use strict'

const Test = require('tape')
const Permissions = require('../../../../src/domain/security/permissions')

Test('Permissions', permissionsTest => {
  permissionsTest.test('should contain Participant permissions', test => {
    test.equal(Permissions.ACCOUNTS_LIST.key, 'ACCOUNTS_LIST')
    test.equal(Permissions.ACCOUNTS_UPDATE.key, 'ACCOUNTS_UPDATE')
    test.end()
  })
})
