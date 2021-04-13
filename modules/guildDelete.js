const {BaseModule} = require("../structures/BaseModule");
const {inspect} = require("util");
const Sentry = require("@sentry/node");
if (process.env.SENTRY_ENVIRONMENT !== "development" && process.env.SENTRY_ENVIRONMENT) Sentry.init();

class Handler extends BaseModule {
	constructor(setup) {
		super(setup);
		this.name = "guildDelete";
		this.event = "guildDelete";

		this.error = (e) => {
			if (process.env.SENTRY_ENVIRONMENT !== "development" && process.env.SENTRY_ENVIRONMENT) {
				Sentry.withScope(function(scope) {
					scope.setTag("module", this.name);
				});
			} else {
				console.error(inspect(e));
			}
		};
	}
	async handle(guild) {
		this.db("queues")
			.where("guild", guild.id)
			.del().catch(this.error);
		this.db("guild_config")
			.where("id", guild.id)
			.del().catch(this.error);
	}
}

module.exports = {Handler};