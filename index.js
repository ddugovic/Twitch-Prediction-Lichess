const OPTS = require('./config.js');
const USER_AGENT = 'Twitch-Prediction-PlayStrategy';

const { StaticAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');

const authProvider = new StaticAuthProvider(OPTS.TWITCH_API_CLIENT_ID, OPTS.TWITCH_API_TOKEN, ['channel:read:predictions', 'channel:manage:predictions']);
const api = new ApiClient({ authProvider });
let broadcaster;
let prediction;

let playstrategyName;
let p1, p2;
let gameColor;
let gameId;

async function getPlayStrategyId() {
  // https://playstrategy.org/api#tag/Account/operation/accountMe
  const headers = {
    Authorization: `Bearer ${OPTS.PLAYSTRATEGY_API_TOKEN}`,
    'User-Agent': USER_AGENT
  };

  user = await fetch('https://playstrategy.org/api/account', {headers: headers})
    .then((res) => res.json());
  console.log(`PlayStrategy user: ${user.username}`);
  playstrategyName = user.title ? `${user.title} ${user.username}` : user.username;
}

async function getPlayStrategyGame(gameId) {
  // https://playstrategy.org/game/export/{gameId}
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${OPTS.LISHOGI_API_TOKEN}`,
    'User-Agent': USER_AGENT
  };

  return await fetch(`https://playstrategy.org/game/export/${gameId}`, {headers: headers})
    .then((res) => res.json());
}

async function streamIncomingEvents() {
  // https://playstrategy.org/api#tag/Board/operation/apiStreamEvent
  const headers = {
    Authorization: `Bearer ${OPTS.PLAYSTRATEGY_API_TOKEN}`,
    'User-Agent': USER_AGENT
  };

  const response = await fetch('https://playstrategy.org/api/stream/event', {headers: headers})
  for await (const chunk of response.body) {
    // Ignore keep-alive 1-byte chunks
    if (chunk.length > 1) try {
      const data = Buffer.from(chunk).toString('utf8');
      let json = JSON.parse(data);
      let game = json.game;
      // Do not create a prediction if some other process already created one
      if (json.type == 'gameStart' && game.source != 'simul' && game.speed != 'correspondence' && !prediction) {
        gameId = game.id;
        console.log(`Game ${game.id} started!`);
        createPrediction(game);
      }
      if (json.type == 'gameFinish' && game.id == gameId && prediction) {
        console.log(`Game ${game.id} finished!`);
        endPrediction(game.id);
        gameId = undefined;
        prediction = undefined;
      }
    } catch (e) {
      console.error(e);
    }
  }
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

async function createPrediction(game) {
  game = await getPlayStrategyGame(game.id);
  p1 = game.players.p1;
  p2 = game.players.p2;
  gameColor = p1.user?.name == playstrategyName ? 'p1' : 'p2';
  opponent = p1.user?.name == playstrategyName ? p2 : p1;
  prediction = await api.predictions.createPrediction(broadcaster, {
    title: `Who will win? #${game.id}`,
    outcomes: [playstrategyName, opponent.aiLevel ? 'AI' : opponent.user.name, "Draw"],
    autoLockAfter: Math.min(game.clock.totalTime, OPTS.PREDICTION_PERIOD)
  });
  console.log(`- Prediction ${prediction.id} is ${prediction.status}`);
}

async function cancelPrediction(predictionId) {
  return await api.predictions.cancelPrediction(broadcaster, predictionId);
}

async function resolvePrediction(predictionId, outcomeId) {
  return await api.predictions.resolvePrediction(broadcaster, predictionId, outcomeId);
}

async function endPrediction(gameId) {
  const predictionId = prediction.id;
  const outcomes = prediction.outcomes;
  game = await getPlayStrategyGame(gameId);
  let outcomeId;
  switch (game.winner || game.status) {
    case gameColor:
      console.log(`- ${playstrategyName} won!`);
      outcomeId = outcomes[0].id;
      break;
    case 'p1':
    case 'p2':
      console.log(`- ${playstrategyName} lost!`);
      outcomeId = outcomes[1].id;
      break;
    case 'draw':
    case 'stalemate':
      console.log(`- ${playstrategyName} drew!`);
      outcomeId = outcomes[2].id;
      break;
    default:
      console.log(`- Game ${game.status}!`);
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
  .then(_ => getPlayStrategyId())
  .then(_ => streamIncomingEvents());
