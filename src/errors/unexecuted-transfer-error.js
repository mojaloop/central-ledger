'use strict'

function UnexecutedTransferError () {}
UnexecutedTransferError.prototype = Object.create(Error.prototype)
UnexecutedTransferError.prototype.name = 'UnexecutedTransferError'
UnexecutedTransferError.prototype.message = 'The provided entity is syntactically correct, but there is a generic semantic problem with it.'
module.exports = UnexecutedTransferError
