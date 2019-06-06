/* const { Botkit } = require('botkit');
const { WatsonMiddleware } = require('botkit-middleware-watson');
const { SlackAdapter } = require('botbuilder-adapter-slack');
const mongoProvider = require('./db/mongo-provider')({
    mongoUri: process.env.MONGO_CONNECTION_STRING
});
const express = require('express');

const eventListeners = require('./listeners/events');
const basicListener = require('./listeners/basic-ears');
const interactiveListener = require('./listeners/interactive');
const { getFilterMiddleware } = require('./listeners/middleware/migration-filter');

const adapter = new SlackAdapter({
    clientSigningSecret: process.env.SLACK_SIGNING_SECRET,
    botToken: process.env.SLACK_BOT_TOKEN
});

let botCfg = {
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    scopes: ['bot', 'team:read', 'users:read', 'users:read.email', 'channels:write'],
    storage: mongoProvider,
    clientSigningSecret: process.env.SLACK_SIGNING_SECRET
};

let controller = Botkit.slackbot(botCfg);
const controller = new Botkit({
    adapter,
    storage: mongoProvider
    // ...other options
});
controller.middleware.receive.use(getFilterMiddleware(controller));

const watsonMiddleware = new WatsonMiddleware({
    iam_apikey: process.env.WATSON_API_KEY,
    url: process.env.WATSON_API_URL,
    workspace_id: process.env.WATSON_WS_ID,
    version: '2018-07-10',
});
controller.middleware.receive.use(watsonMiddleware.receive.bind(watsonMiddleware));

controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention'], async function (bot, message) {
    console.log(message.watsonError);
    console.log(message.watsonData);

    if (message.watsonError) {
        await bot.reply(message, "I'm sorry, but for technical reasons I can't respond to your message");
    } else {
        await bot.reply(message, message.watsonData.output.text.join('\n'));
    }
});

eventListeners(controller);
basicListener(controller);
interactiveListener(controller);

module.exports = controller;

const app = express();
const port = process.env.PORT || 5000;
app.set('port', port);
app.listen(port, () => {
    console.log('Client server listening on port ' + port);
}); */

require('dotenv').config();

const { Botkit } = require('botkit');
const { MemoryStorage } = require('botbuilder');
const { SlackAdapter } = require('botbuilder-adapter-slack');

const express = require('express');
const WatsonMiddleware = require('botkit-middleware-watson').WatsonMiddleware;

const mongoProvider = require('./db/mongo-provider')({
    mongoUri: process.env.MONGO_CONNECTION_STRING
});

const middleware = new WatsonMiddleware({
    iam_apikey: process.env.WATSON_API_KEY,
    workspace_id: process.env.WATSON_WS_ID,
    url: process.env.WATSON_API_URL || 'https://gateway.watsonplatform.net/assistant/api',
    version: '2018-07-10'
});

// Configure your bot.
const adapter = new SlackAdapter({
    clientSigningSecret: process.env.SLACK_SIGNING_SECRET,
    botToken: process.env.SLACK_BOT_TOKEN,
});
const controller = new Botkit({
    adapter,
    storage: mongoProvider
    // ...other options
});

controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention'], async (bot, message) => {
    console.log('Slack message received');
    await middleware.interpret(bot, message);
    if (message.watsonError) {
        console.log(message.watsonError);
        await bot.reply(message, message.watsonError.description || message.watsonError.error);
    } else if (message.watsonData && 'output' in message.watsonData) {
        await bot.reply(message, message.watsonData.output.text.join('\n'));
    } else {
        console.log('Error: received message in unknown format. (Is your connection with Watson Assistant up and running?)');
        await bot.reply(message, 'I\'m sorry, but for technical reasons I can\'t respond to your message');
    }
});

// Create an Express app
const app = express();
const port = process.env.PORT || 5000;
app.set('port', port);
app.listen(port, function () {
    console.log('Client server listening on port ' + port);
});