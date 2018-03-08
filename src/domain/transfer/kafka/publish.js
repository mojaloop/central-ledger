// STUFF TO GO IN HERE FOR RE-USABLE PRODUCER CODE

const Events = require('../../lib/events')

const publishHandler = (event) => {
    return (topic, msg) => {
        //code to publish the message to the topic
    }
}

const wireEvents = () => {
    Events.onPublishMessage(publishHandler('publish.message'))
}

// for nodejs v8.x upgrade (hapi server v17.xx)
// exports.plugin = {
//     name: 'publishkafka',
//     register: (server, options) => {
//         wireEvents()
//     }
// }

exports.register = (server, options, next) => {
    wireEvents()
    next()
}

exports.register.attributes = {
    name: 'publish.message'
}
