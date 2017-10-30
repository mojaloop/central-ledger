'use strict'

const Docker = require('./docker')
const Variables = require('./variables')

const pushImageToEcr = (imageName, version) => {
  const ecrImage = `${Variables.AWS_ACCOUNT_ID}.dkr.ecr.${Variables.AWS_REGION}.amazonaws.com/${imageName}`
  const versioned = `${ecrImage}:${version}`
  const latest = `${ecrImage}:latest`

  return Docker.tagAndPush(imageName, versioned)
    .then(() => Docker.tagAndPush(imageName, latest))
    .then(() => ({ versioned, latest }))
}

module.exports = {
  pushImageToEcr
}
