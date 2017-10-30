'use strict'

const AWS = require('aws-sdk')
const Promise = require('bluebird')
const Exec = Promise.promisify(require('child_process').exec)
const Variables = require('./variables')

const configureAws = () => {
  return Exec(`aws configure set default.region ${Variables.AWS_REGION}`)
    .then(() => Exec('aws ecr get-login'))
    .then(result => {
      return Exec(result)
    })
    .then(r => {
      return AWS.config.update({ region: Variables.AWS_REGION })
    })
}

module.exports = {
  configureAws
}
