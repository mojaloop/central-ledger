let supertest = require('supertest')
let server
let request

(async function() { // async function expression used as an IIFE
   server = await require('../../src/api/index');
   request = supertest.agent(server.listener);
})()


module.exports = {
  server,
  request
}
