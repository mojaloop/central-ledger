'use strict'

const nodemailer = require('nodemailer')
const Config = require('../../lib/config')
const Logger = require('@mojaloop/central-services-shared').Logger

const sendEmail = () => {
  return (mailInformation) => {
    // create reusable transporter object using SMTP transport
    const transporter = nodemailer.createTransport({
      host: Config.EMAIL_SMTP,
      port: 465,
      secure: true, // use SSL
      auth: {
        party: Config.EMAIL_PARTY,
        pass: Config.EMAIL_PASSWORD
      }
    })

    const mailOptions = {
      from: Config.EMAIL_PARTY, // sender address
      to: mailInformation.email, // receiver
      subject: 'Settlements', // Subject line
      text: 'Please see attached settlements', // plaintext body
      attachments: [
        {
          filename: 'Settlements.csv',
          content: mailInformation.csvFile
        }
      ]
    }

    // verify connection configuration
    transporter.verify(function (error, success) {
      if (error) {
        Logger.error(error)
      }
      Logger.info('Server is ready to take our messages')
    })

    // send mail with defined transport object
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        return Logger.error(error)
      }
      Logger.info('Message sent: ' + info.response)
    })
  }
}

module.exports = {
  sendEmail
}
