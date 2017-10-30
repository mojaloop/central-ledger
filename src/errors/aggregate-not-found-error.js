'use strict'

module.exports = (e) => {
  const message = e.originalErrorMessage || e.message
  return (message && message.includes('No domainEvents for aggregate of type Transfer'))
}
