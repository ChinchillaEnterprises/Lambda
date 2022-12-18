const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SLACK_USER = process.env.SLACK_USER;

const https = require('https');
const zlib = require('zlib');

exports.handler = async (event, context) => {
  try {
    const payload = Buffer.from(event.awslogs.data, 'base64');
    const parsedPayload = JSON.parse(zlib.gunzipSync(payload).toString('utf8'));
    const logGroup = parsedPayload.logGroup;
    const logEvents = parsedPayload.logEvents;

    let cwlErrorMessage = '';

    for (let logEvent of logEvents) {

      if (logGroup.includes('lambda') == true) {

        if (logEvent.message.includes('START RequestId') == true) {

          continue
        }

        if (logEvent.message.includes('END RequestId:') == true) {

          continue
        }


        if (logEvent.message.includes('REPORT RequestId:') == true) {

          continue
        }


        if (logEvent.message.includes('Billed Duration:') == true) {

          continue
        }
      }


      if (logGroup.includes('aws-glue') == true) {


        if (logEvent.message.includes('Running Start Crawl') == false && logEvent.message.includes('authenticom') == false && logEvent.message.includes('Crawler has finished running') == false) {

          continue
        }

        if (logEvent.message.includes('INFO') == true) {

          logEvent.message = logEvent.message.split('INFO')
          logEvent.message = logEvent.message[1]
          logEvent.message = logEvent.message.replace(':','')          
        }

        if (logEvent.message.includes('BENCHMARK') == true) {

          logEvent.message = logEvent.message.split('BENCHMARK')
          logEvent.message = logEvent.message[1]
          logEvent.message = logEvent.message.replace(':','')
        }

      }

      cwlErrorMessage += logEvent.message + "\n";


    }

    // check empty error message
    if ('' === cwlErrorMessage) {
      throw new Error('Empty error message');
    }

    let userAccountNotification = {
      'username': SLACK_USER, // This will appear as user name who posts the message
      'blocks': [{
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": cwlErrorMessage.replace(/"/g, '') // The message content, replace double quote
        }
      }],
    };

    await sendSlackMessage(userAccountNotification);

    return `Successfully processed ${parsedPayload.logEvents.length} log events.`;

  }
  catch (error) {
    console.error('Stg CloudWatch Error Alarm: error sending slack notification ', error);
  }
};


const sendSlackMessage = (messageBody) => {
  return new Promise((resolve, reject) => {
    // check webhook url
    if (!SLACK_WEBHOOK_URL) {
      reject('No Webhook URL');
    }

    // general request options, we defined that it's a POST request and content is JSON
    const requestOptions = {
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      }
    };

    // actual request
    const req = https.request(SLACK_WEBHOOK_URL, requestOptions, (res) => {
      let response = '';

      res.on('data', (d) => {
        response += d;
      });

      // response finished, resolve the promise with data
      res.on('end', () => {
        resolve(response);
      })
    });

    // there was an error, reject the promise
    req.on('error', (e) => {
      reject(e);
    });

    // send our message body (was parsed to JSON beforehand)
    req.write(JSON.stringify(messageBody));
    req.end();
  });
};
