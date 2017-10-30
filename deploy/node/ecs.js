'use strict'

const AWS = require('aws-sdk')
const ecs = new AWS.ECS()
const Variables = require('./variables')

const registerTaskDefinition = (name, service, image, port, environment = []) => {
  const params = {
    containerDefinitions: [
      {
        name,
        image,
        essential: true,
        memoryReservation: 200,
        portMappings: [
          {
            containerPort: port
          }
        ],
        links: [
          `${Variables.SIDECAR.NAME}:${Variables.SIDECAR.NAME}`
        ],
        environment,
        logConfiguration: {
          logDriver: 'syslog',
          options: {
            'syslog-address': 'tcp://127.0.0.1:514',
            'syslog-facility': 'daemon',
            'tag': service
          }
        }
      },
      {
        name: Variables.SIDECAR.NAME,
        image: `${Variables.AWS_ACCOUNT_ID}.dkr.ecr.${Variables.AWS_REGION}.amazonaws.com/${Variables.SIDECAR.IMAGE}:latest`,
        essential: true,
        memoryReservation: 200,
        portMappings: [
          {
            containerPort: Variables.SIDECAR.PORT
          }
        ],
        environment: [
          {
            name: 'SIDE_SERVICE',
            value: service
          },
          {
            name: 'SIDE_DATABASE_URI',
            value: `postgres://${Variables.SIDECAR.POSTGRES_USER}:${Variables.SIDECAR.POSTGRES_PASSWORD}@${Variables.SIDECAR.POSTGRES_HOST}:5432/sidecar`
          },
          {
            name: 'SIDE_KMS__URL',
            value: Variables.SIDECAR.KMS_URL
          }
        ],
        logConfiguration: {
          logDriver: 'syslog',
          options: {
            'syslog-address': 'tcp://127.0.0.1:514',
            'syslog-facility': 'daemon',
            'tag': `sidecar-${service}`
          }
        }
      }
    ],
    family: name
  }

  return ecs.registerTaskDefinition(params).promise()
    .then(result => {
      const revision = result.taskDefinition.taskDefinitionArn
      console.log(`Registered task definition: ${revision}`)
      return revision
    })
}

const deployService = (clusterName, service, taskDefinition) => {
  const params = {
    service,
    taskDefinition,
    cluster: clusterName,
    desiredCount: 1
  }

  console.log(`Deploying ${taskDefinition} to ${service} on cluster ${clusterName}`)

  return ecs.updateService(params).promise()
    .then(result => result.service.taskDefinition)
}

module.exports = {
  registerTaskDefinition,
  deployService
}
