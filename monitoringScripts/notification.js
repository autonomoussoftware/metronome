var aws = require('aws-sdk')
aws.config.loadFromPath(__dirname + '/config-ses.json')
var ses = new aws.SES({apiVersion: '2010-12-01'})
var sesEmail = {
  params: {
    Destination: { /* required */
      CcAddresses: [
        'manoj.patidar@gmail.com'
      ],
      ToAddresses: [
        'manoj.patidar@gmail.com'
      ]
    },
    Message: { /* required */
      Body: { /* required */
        Html: {
          Charset: 'UTF-8',
          Data: 'test html'
        },
        Text: {
          Charset: 'UTF-8',
          Data: 'test plantext'
        }
      },
      Subject: {
        Charset: 'UTF-8',
        Data: 'Test email'
      }
    },
    Source: 'manoj.patidar@gmail.com', /* required */
    ReplyToAddresses: [
      'manoj.patidar@gmail.com'
    ]
  },
  sendEmail: (title, response) => {
    sesEmail.params.Message.Body.Html.Data = response
    sesEmail.params.Message.Subject.Data = title
    ses.sendEmail(sesEmail.params, function (err, data) {
      if (err) console.log(err, err.stack) // an error occurred
      else console.log(data) // successful response
    })
  }
}

module.exports = sesEmail
