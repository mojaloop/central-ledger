
// STUFF TO GO IN HERE FOR RE-USABLE CONSUMING
const kafka = require('kafka-node').Consumer
const Consumer = kafka.Consumer;
const Commands = require('../commands')

const consumePrepare = () => {
    client = new kafka.Client("a02bcb8d21d2d11e8ada0027eebfb29a-160662342.eu-west-2.elb.amazonaws.com:2181");
    consumer = new Consumer(
        client,
        [
            { topic: 'topic-dfsp1-prepare-tx', partition: 0, offset: 0 }
        ],
        { fromOffset: true }
    );

    consumer.on('message', function (message) {
        console.log(message);
        // figure out what message appear here
        // const transfer = Translator.fromPayload(payload)
        // Commands.prepareExecute(transfer).then(result => {
        // })
    });

    consumer.on('error', function (err) {
        console.log('ERROR: ' + err.toString());
    });
}

const consumeNotification = () => {
    client = new kafka.Client("a02bcb8d21d2d11e8ada0027eebfb29a-160662342.eu-west-2.elb.amazonaws.com:2181");
    consumer = new Consumer(
        client,
        [
            { topic: 'topic-dfsp1-prepare-notification', partition: 0, offset: 0 }
        ],
        { fromOffset: true }
    );

    consumer.on('message', function (message) {
        console.log(message);
        //need to call something in the commands/index.js
    });

    consumer.on('error', function (err) {
        console.log('ERROR: ' + err.toString());
        //error handling code needs to go here
    });
}

exports.register = (server, options, next) => {
    consumePrepare()
    consumeNotification()
    next()
}

exports.register.attributes = {
    name: 'consume.message'
}
