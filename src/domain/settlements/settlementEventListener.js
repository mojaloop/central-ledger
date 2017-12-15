'use strict'

const nodemailer = require('nodemailer')
const Config = require('../../lib/config')

const sendEmail = () => {
  return (mailInformation) => {
    // create reusable transporter object using SMTP transport
    const transporter = nodemailer.createTransport({
      host: Config.EMAIL_SMTP,
      port: 465,
      secure: true, // use SSL
      auth: {
        user: Config.EMAIL_USER,
        pass: Config.EMAIL_PASSWORD
      }
    })

    const mailOptions = {
      from: Config.EMAIL_USER, // sender address
      to: mailInformation.email, // receiver
      subject: 'Hello', // Subject line
      text: 'Hello world', // plaintext body
      html: '<b>Hello world</b>', // html body
      attachments: [
        {
          filename: 'test.csv',
          content: mailInformation.csvFile
        }
      ]
    }

    // verify connection configuration
    transporter.verify(function (error, success) {
      if (error) {
        console.log(error)
      } else {
        console.log('Server is ready to take our messages')
      }
    })

    // send mail with defined transport object
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        return console.log(error)
      }
      console.log('Message sent: ' + info.response)
    })
  }
}

module.exports = {
  sendEmail
}
