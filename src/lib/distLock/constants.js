const ERROR_MESSGAES = {
  ACQUIRE_ERROR: 'Failed to acquire lock',
  NO_LOCK_TO_RELEASE: 'No lock to release',
  NO_LOCK_TO_EXTEND: 'No lock to extend',
  REDLOCK_ERROR: 'Redlock error occurred',
  INVALID_CONFIG: 'Invalid configuration for distributed lock',
  TIMEOUT_ERROR: 'Timeout while trying to acquire lock'
}

module.exports = {
  ERROR_MESSGAES
}
