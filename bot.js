require('dotenv').config();

const { Botkit } = require('botkit');
const { SlackAdapter, SlackMessageTypeMiddleware, SlackEventMiddleware } = require('botbuilder-adapter-slack');

const dialogflowMiddleware = require('./df-middleware');
const mongoProvider = require('./db/mongo-provider')({
    mongoUri: process.env.MONGO_CONNECTION_STRING
});

const adapter = new SlackAdapter({
    clientSigningSecret: process.env.SLACK_SIGNING_SECRET,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    scopes: ['bot', 'team:read', 'users:read', 'users:read.email', 'channels:write'],
    redirectUri: process.env.SLACK_REDIRECT_URI,
    getTokenForTeam: getTokenForTeam,
    getBotUserByTeam: getBotUserByTeam
});
adapter.use(new SlackEventMiddleware());
adapter.use(new SlackMessageTypeMiddleware());

const controller = new Botkit({
    webhook_uri: '/slack/receive',
    adapter
});

controller.addPluginExtension('database', mongoProvider);

controller.middleware.receive.use(dialogflowMiddleware.receive);

controller.ready(() => {
    controller.loadModules(__dirname + '/features');
});

controller.webserver.get('/login', (req, res) => {
    res.redirect(controller.adapter.getInstallLink());
});

controller.webserver.get('/oauth', async (req, res) => {

    try {
        const results = await controller.adapter.validateOauthCode(req.query.code);
        console.log('FULL OAUTH DETAILS', results);
        let newTeam = {
            id: results.team_id,
            bot_access_token: results.bot.bot_access_token,
            bot_user_id: results.bot.bot_user_id
        };

        controller.plugins.database.teams.save(newTeam, (err, user) => {
            tokenCache[results.team_id] = results.bot.bot_access_token;
            userCache[results.team_id] =  results.bot.bot_user_id;
            res.json('Success! Bot installed.');
        });
    } catch (err) {
        console.error('OAUTH ERROR:', err);
        res.status(401);
        res.send(err.message);
    }
});

let tokenCache = {};
let userCache = {};

if (process.env.TOKENS) {
    tokenCache = JSON.parse(process.env.TOKENS);
} 

if (process.env.USERS) {
    userCache = JSON.parse(process.env.USERS);
} 

async function getTokenForTeam(teamId) {

    if (tokenCache[teamId]) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(tokenCache[teamId]);
            }, 150);
        });
    } else {
        console.error('Team not found in tokenCache: ', teamId);
    }
}

async function getBotUserByTeam(teamId) {

    if (userCache[teamId]) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(userCache[teamId]);
            }, 150);
        });
    } else {
        console.error('Team not found in userCache: ', teamId);
    }
}