'use strict'

const Promise = require('bluebird')
const Exec = Promise.promisify(require('child_process').exec)

const tagImage = (imageName, tag) => {
  return Exec(`docker tag ${imageName} ${tag}`)
}

const pushImage = (image) => {
  console.log('Pushing image: ' + image)
  return Exec(`docker push ${image}`)
}

const tagAndPush = (imageName, tag) => {
  return tagImage(imageName, tag)
    .then(() => pushImage(tag))
}

const login = (email, user, password, repo) => {
  return Exec(`docker login -e ${email} -u ${user} -p ${password} ${repo}`)
}

module.exports = {
  login,
  tagAndPush
}
