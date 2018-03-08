// STUFF TO GO IN HERE FOR RE-USABLE PRODUCER CODE

const Events = require('../../lib/events')
const kafka = require('kafka-node');
const Producer = kafka.Producer;
const KeyedMessage = kafka.KeyedMessage;
const Client = kafka.Client;
const Logger = require('@mojaloop/central-services-shared').Logger

const client = new Client('a02bcb8d21d2d11e8ada0027eebfb29a-160662342.eu-west-2.elb.amazonaws.com:2181');

const 

const publishHandler = (event) => {
    return (topic, key, msg) => {        
        var topic = topic;
        var p = 0;
        var a = 0;
        var producer = new Producer(client, { requireAcks: -1 });

        producer.on('ready', function () {
            var message = msg;
            var keyedMessage = new KeyedMessage(key, message);

            producer.send([
                { topic: topic, partitions: p, messages: [keyedMessage], attributes: a }
            ], function (err, result) {
                Logger.info("Publish topic(%s) result: %s", topic, (err || result));
                process.exit();
            })
            Logger.info("Sent something keyedMessage='%s'", keyedMessage);
        });

        producer.on('error', function (err) {
            Logger.error('error: %s', err);
        });
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
