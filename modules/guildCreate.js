const {BaseModule} = require("../structures/BaseModule");
const {inspect} = require("util");
const Sentry = require("@sentry/node");
if (process.env.SENTRY_ENVIRONMENT !== "development" && process.env.SENTRY_ENVIRONMENT) Sentry.init();

class Handler extends BaseModule {
	constructor(setup) {
		super(setup);
		this.name = "guildCreate";
		this.event = "guildCreate";

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
		// Add Eventcord Nickname
		const addBotNickname = () => {
			const botPerms = guild.permissionsOf(this.bot.user.id);
			if (botPerms.json.changeNickname === true) {
				guild.editNickname(process.env.BOT_NICKNAME);
			}
		};
		if (process.env.BOT_NICKNAME) addBotNickname();

		const leave = async () => {
			await this.bot.leaveGuild(guild.id);
			console.log("Blocked blacklisted guild " + guild.id + ` (${guild.name})`);
		};

		const blacklisted = await this.db("blacklisted_guilds").where("id", guild.id).select("*").catch(this.error);
		if (blacklisted[0]) {
			leave();
		}

		if (process.env.NODE_ENV !== "production") {
			const whitelisted = await this.db("whitelisted_guilds").where("id", guild.id).select("*").catch(this.error);
			if (!whitelisted[0]) {
				leave();
			} else {
				console.log("Joined whitelisted guild " + guild.id + ` (${guild.name})`);
			}
		} 
	}
}

module.exports = {Handler};