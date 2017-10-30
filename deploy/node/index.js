'use strict'

const Aws = require('./aws')
const Ecr = require('./ecr')
const Ecs = require('./ecs')
const Jfrog = require('./jfrog')
const Variables = require('./variables')

const pushService = ({IMAGE, NAME, PORT}, version) => {
  const databaseUri = `postgres://${Variables.POSTGRES_USER}:${Variables.POSTGRES_PASSWORD}@${Variables.POSTGRES_HOST}:5432/central_ledger`
  const envVariables = [
    {
      name: 'CLEDG_DATABASE_URI',
      value: databaseUri
    },
    {
      name: 'CLEDG_HOSTNAME',
      value: Variables.HOSTNAME
    },
    {
      name: 'CLEDG_EXPIRES_TIMEOUT',
      value: '1800000'
    },
    {
      name: 'CLEDG_ENABLE_BASIC_AUTH',
      value: 'true'
    },
    {
      name: 'CLEDG_SIDECAR__HOST',
      value: Variables.SIDECAR.NAME
    }
  ]
  const serviceName = `${NAME}-${Variables.ENVIRONMENT}`
  return Ecr.pushImageToEcr(IMAGE, version)
    .then(result => Ecs.registerTaskDefinition(serviceName, NAME, result.versioned, PORT, envVariables))
    .then(taskDefinition => Ecs.deployService(Variables.CLUSTER, serviceName, taskDefinition))
}

const deploy = () => {
  const version = Variables.VERSION
  Aws.configureAws()
    .then(() => pushService(Variables.API, version))
    .then(() => pushService(Variables.ADMIN, version))
    .then(() => Jfrog.login())
    .then(() => Jfrog.pushImageToJFrog(Variables.API.IMAGE, version))
    .then(() => Jfrog.pushImageToJFrog(Variables.ADMIN.IMAGE, version))
    .catch(e => {
      console.error(e)
      process.exit(1)
    })
}

module.exports = deploy()
