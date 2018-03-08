
const Publish = require('./publish')
const Consume = require('./consume')

const getPrepareTxTopicName = (uri) => {
    return "topic-dfsp1-prepare-tx"
}

const getPrepareNotificationTopicName = (uri) => {
    return "topic-dfsp1-prepare-notification"
}

// const publish = (?) => {
//     //TBD by laz
//     return ??
// }

// const consume = (?) => {
//     //TBD 
//     return ??
// }

module.exports = {
    getPrepareTxTopicName,
    getPrepareNotificationTopicName
}
