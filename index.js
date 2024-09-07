// vvvv for debugging
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

const OPTS = require('./config.js');
const USER_AGENT = 'Twitch-Prediction-Lichess';

let lichessName;
let gameColor;
let gameSecondsLeft;

const { StaticAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');

const authProvider = new StaticAuthProvider(OPTS.TWITCH_API_CLIENT_ID, OPTS.TWITCH_API_TOKEN, ['channel:read:predictions', 'channel:manage:predictions']);
const api = new ApiClient({ authProvider });
let broadcaster;
let prediction;

// lichess api client module
const https = require('https');

async function getLichessId() {
  // https://lichess.org/api#tag/Account/operation/accountMe
  const headers = {
    Authorization: `Bearer ${OPTS.LICHESS_API_TOKEN}`,
    'User-Agent': USER_AGENT
  };

  lichessName = await fetch('https://lichess.org/api/account', {headers: headers})
  .then((res) => res.json())
  .then(json => json.username);
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
          if (json.type == 'gameStart' && game.speed != 'correspondence' && !prediction) {
            console.log(`Game ${game.id} started!`);
            gameColor = game.color;
            gameSecondsLeft = game.secondsLeft;
            createPrediction(game.opponent);
          }
          if (json.type == 'gameFinish' && game.speed != 'correspondence' && prediction) {
            console.log(`Game ${game.id} finished!`);
            endPrediction(game.winner || game.status?.name);
            prediction = undefined;
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

async function getBroadcaster() {
  broadcaster = await api.users.getUserByName(OPTS.TWITCH_CHANNEL);
}

async function getPrediction() {
  const predictions = await api.predictions.getPredictions(broadcaster, {limit: 1});
  if (predictions?.data?.length && /^(?:ACTIVE|LOCKED)$/.test(predictions.data[0].status)) {
    prediction = predictions.data[0];
  }
  return predictions;
}

async function createPrediction(opponent) {
  prediction = await api.predictions.createPrediction(broadcaster, {
    title: "Who will win?",
    outcomes: [lichessName, opponent.username, "Draw"],
    autoLockAfter: Math.min(gameSecondsLeft, OPTS.PREDICTION_PERIOD)
  });
  console.log(`- Prediction ${prediction.id} is ${prediction.status}`);
}

async function cancelPrediction(predictionId) {
  return await api.predictions.cancelPrediction(broadcaster, predictionId);
}

async function resolvePrediction(predictionId, outcomeId) {
  return await api.predictions.resolvePrediction(broadcaster, predictionId, outcomeId);
}

async function endPrediction(outcome) {
  const predictionId = prediction.id;
  const outcomes = prediction.outcomes;
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
  if (outcomeId) {
    resolvePrediction(predictionId, outcomeId);
    console.log(`- Prediction ${predictionId} resolved.`);
  } else {
    cancelPrediction(predictionId);
    console.log(`- Prediction ${predictionId} canceled.`);
  }
}

getBroadcaster()
  .then(_ => getPrediction())
  .then(_ => getLichessId())
  .then(_ => streamIncomingEvents());
