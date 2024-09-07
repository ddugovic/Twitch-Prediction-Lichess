# Twitch-Prediction-Lishogi

Forked from/heavily based on [AndrewYatzkan/Twitch-Prediction-Lishogi](https://github.com/AndrewYatzkan/Twitch-Prediction-Lishogi) to allow Twitch affiliates/partners to manage predictions.

## Setup:

1) Install [Node.js](https://nodejs.org/en/download/).

2) Download Twitch-Prediction-Lishogi and navigate to the folder in Terminal (Mac/Linux) or Command Prompt (Windows).

3) Create [Twitch application](https://dev.twitch.tv/docs/authentication/register-app/) with scopes `channel:read:predictions channel:manage:predictions`.
- You can generate the Twitch OAuth token [here](https://twitchapps.com/tmi/).

4) Create a [Lishogi Board API token](https://lishogi.org/account/oauth/token/create?scopes[]=board:play&description=Twitch%20Prediction).

5) Copy or rename the `config.sample.js` file to `config.js` and adjust the values:
```js
module.exports = {
  LISHOGI_API_TOKEN: 'lip_...',	// Lishogi Board API token
  TWITCH_API_CLIENT_ID: '',     // Twitch API client ID
  TWITCH_API_TOKEN: '',         // Twitch API token (without "oauth:" prefix)
  TWITCH_CHANNEL: '',           // Twitch username (affiliate/partner only)
  PREDICTION_PERIOD: 60,        // Maximum duration for prediction to remain open in s
};
```

6) Run `npm start` to start the bot.

7) Play games. Twitch predictions will automatically be created and resolved!
- Note: correspondence games and hosting a simultaneous exhibition are not currently supported.
