'use strict'

const Path = require('path')
const ChildProcess = require('child_process')
const Base = require('../functional/base')

process.env.TEST_ILP_PREFIX = 'us.usd.red.'
process.env.TEST_ACCOUNT_URI = 'http://localhost:3000/accounts'
process.env.TEST_ACCOUNT_1 = Base.account1Name
process.env.TEST_ACCOUNT_2 = Base.account2Name
process.env.TEST_PASSWORD_1 = Base.account1Password
process.env.TEST_PASSWORD_2 = Base.account2Password
process.env.TEST_EMAIL_1 = Base.account1Name + '@test.com'
process.env.TEST_EMAIL_2 = Base.account2Name + '@test.com'
process.env.ILP_PLUGIN_TEST_CONFIG = Path.join(__dirname, '../../node_modules/five-bells-ledger-api-tests/index.js')

ChildProcess.execSync('npm test', {
  cwd: Path.join(__dirname, '../../node_modules/ilp-plugin-tests'),
  env: process.env,
  stdio: 'inherit'
})
