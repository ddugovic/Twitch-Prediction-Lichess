# Twitch-Prediction-Lichess

Forked from/heavily based on [AndrewYatzkan/Twitch-Prediction-Lichess](https://github.com/AndrewYatzkan/Twitch-Prediction-Lichess) to allow Twitch affiliates/partners to manage predictions.

## Setup:

1) Install [Node.js](https://nodejs.org/en/download/).

2) Download Twitch-Prediction-Lichess and navigate to the folder in Terminal (Mac/Linux) or Command Prompt (Windows).

3) Run `npm i`.
- Note: if you get an error, try running `sudo npm i` on Mac/Linux or running the Command Prompt as Administrator on Windows.

4) Create [Twitch application](https://dev.twitch.tv/docs/authentication/register-app/) with scopes `channel:read:predictions channel:manage:predictions`.

You can generate the Twitch OAuth token [here](https://twitchapps.com/tmi/).

5) Copy or rename the `config.sample.js` file to `config.js` and adjust the values:
```js
module.exports = {
  LICHESS_API_TOKEN: 'lip_...',	// Streamer's Lichess Board API token
  TWITCH_API_CLIENT_ID: '',	// Streamer's Twitch API client ID
  TWITCH_API_TOKEN: '',		// Streamer's Twitch API token (without "oauth:" prefix)
  TWITCH_CHANNEL: '',		// Streamer's Twitch username (affiliate/partner only)
  PREDICTION_PERIOD: 60,	// Maximum duration for prediction to remain open in s
};
```

6) Run `npm start` to start the bot.

7) Play [Board API](https://lichess.org/api#tag/Board/operation/apiStreamEvent)-[compatible](https://lichess.org/@/lichess/blog/welcome-lichess-boards/XlRW5REA) games. Twitch predictions will automatically be created and resolved!
- Note: correspondence games and hosting a simultaneous exhibition are not currently supported.
