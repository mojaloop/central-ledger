'use strict'

const Variables = require('./variables')
const Docker = require('./docker')

const login = () => {
  return Docker.login(Variables.DOCKER_EMAIL, Variables.DOCKER_USER, Variables.DOCKER_PASS, Variables.JFROG_REPO)
}

const pushImageToJFrog = (imageName, version) => {
  const jfrogImage = `${Variables.JFROG_REPO}/${imageName}`
  const versioned = `${jfrogImage}:${version}`
  const latest = `${jfrogImage}:latest`

  return Docker.tagAndPush(imageName, latest)
    .then(() => Docker.tagAndPush(imageName, versioned))
}

module.exports = {
  login,
  pushImageToJFrog
}
