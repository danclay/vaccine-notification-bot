# vaccine-notification-bot
 
This is designed with a postgres database with the schema in the setup_info folder.

It also uses slash commands shown in setup_info.

The environment variables follow along the lines of:

```json
NODE_ENV=
SENTRY_ENVIRONMENT= // if using sentry for error logging
SENTRY_DSN=

SHARDER_OPTIONS={"token": "bot token", "clientOptions": {"intents": ["guilds", "guildMessages", "directMessages"]}} // Options to pass to eris-fleet

DATABASE_URL=
DATABASE_CONFIG= // this is the knex config

owners= // bot owners by ID and seperated by commas
blacklist_refresh=300e3 // how often the blacklisted guild database is checked
status_refresh=60e3 // how often to update the bot status (if cycling)
max_subs=15 // max covid zip location subs per user
vaccine_interval=60e3 // how often to check with the vaccine APIs
notification_timeout=900e3 // How long to wait before sending a second notification for the same vaccine location if the location has had appointment information update 
```