// vvvv for debugging
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

const OPTS = require('./config.js');
const USER_AGENT = 'Twitch-Prediction-Lichess';

let lichessName;
let gameColor;
let gameSecondsLeft;
let predictionId;
let outcomes;

const { StaticAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');

const authProvider = new StaticAuthProvider(OPTS.TWITCH_API_CLIENT_ID, OPTS.TWITCH_API_TOKEN, ['channel:read:predictions', 'channel:manage:predictions']);
const apiClient = new ApiClient({ authProvider });

// module to send http requests / communicate with the lichess api
const https = require('https');

function getLichessId() {
  // https://lichess.org/api#tag/Account/operation/accountMe
  const options = {
    hostname: 'lichess.org',
    path: '/api/account',
    headers: {
      Authorization: `Bearer ${OPTS.LICHESS_API_TOKEN}`,
      'User-Agent': USER_AGENT
    }
  };

  return new Promise((resolve, reject) => {
    var req = https.request(options, (res) => {
      res.on('data', (chunk) => {
        let data = chunk.toString();
        try {
          let json = JSON.parse(data);
          lichessName = json.username;
        } catch (e) {
          console.error(e);
        }
      });
    });
    req.end();
  });
}

function streamIncomingEvents() {
  // https://lichess.org/api#tag/Board/operation/apiStreamEvent
  const options = {
    hostname: 'lichess.org',
    path: '/api/stream/event',
    headers: {
      Authorization: `Bearer ${OPTS.LICHESS_API_TOKEN}`,
      'User-Agent': USER_AGENT
    }
  };

  return new Promise((resolve, reject) => {
    https.get(options, (res) => {
      res.on('data', (chunk) => {
        let data = chunk.toString();
        if (data.length > 1) try {
          let json = JSON.parse(data);
          // TODO: simultaneous exhibition (score prediction)
          // assume only one timed game can be played concurrently
          let game = json.game;
          if (json.type == 'gameStart' && game.speed != 'correspondence') {
            console.log(`Game ${game.id} started!`);
            gameColor = game.color;
            gameSecondsLeft = game.secondsLeft;
            createPrediction(game.opponent);
          }
          if (json.type == 'gameFinish' && game.speed != 'correspondence' && predictionId) {
            console.log(`Game ${game.id} finished!`);
            endPrediction(game.winner || game.status?.name, predictionId, outcomes);
            predictionId = undefined;
            outcomes = undefined;
          }
        } catch (e) {
          console.error(e);
        }
      });
      res.on('end', () => {
        reject(new Error('[streamIncomingEvents()] Stream ended.'));
      });
    });
  });
}

async function createPrediction(opponent) {
  const broadcaster = await apiClient.users.getUserByName(OPTS.TWITCH_CHANNEL);
  const prediction = await apiClient.predictions.createPrediction(broadcaster, {
    title: "Who will win?",
    outcomes: [lichessName, opponent.username, "Draw"],
    autoLockAfter: Math.min(gameSecondsLeft, OPTS.PREDICTION_PERIOD)
  });
  console.log(`- Prediction ${prediction.id} is ${prediction.status}`);
  predictionId = prediction.id;
  outcomes = prediction.outcomes;
}

async function cancelPrediction(broadcaster, predictionId) {
  return await apiClient.predictions.cancelPrediction(broadcaster, predictionId);
}

async function resolvePrediction(broadcaster, predictionId, outcomeId) {
  return await apiClient.predictions.resolvePrediction(broadcaster, predictionId, outcomeId);
}

async function endPrediction(outcome, predictionId, outcomes) {
  const broadcaster = await apiClient.users.getUserByName(OPTS.TWITCH_CHANNEL);
  let outcomeId;
  switch (outcome) {
    case gameColor:
      console.log(`- ${lichessName} won!`);
      outcomeId = outcomes[0].id;
      break;
    case 'black':
    case 'white':
      console.log(`- ${lichessName} lost!`);
      outcomeId = outcomes[1].id;
      break;
    case 'draw':
    case 'stalemate':
      console.log(`- ${lichessName} drew!`);
      outcomeId = outcomes[2].id;
      break;
    default:
      console.log(`- Game ${outcome}!`);
  }
  let prediction;
  if (outcomeId) {
    prediction = resolvePrediction(broadcaster, predictionId, outcomeId);
  } else {
    prediction = cancelPrediction(broadcaster, predictionId);
  }
  console.log(`- Prediction ${predictionId} is ${prediction.status ?? 'CANCELED'}`);
}

getLichessId();
streamIncomingEvents();
