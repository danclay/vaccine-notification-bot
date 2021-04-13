const {BaseModule} = require("../structures/BaseModule");

class Handler extends BaseModule {
	constructor(setup) {
		super(setup);
		this.name = "help";
	}

	handle(data) {
		return data.interaction.send({
			type: 4,
			data: {
				embeds: [
					{
						title: "Covid Vaccine Notification Bot",
						description: "This bot provides notifications to server members upon covid vaccine availibility within the US. The bot will send a DM when new availibility is detected based on the member's subscriptions",
						fields: [
							{
								name: "Manage subscriptions",
								value: "This bot allows server members to subscribe to zip codes. Use `/sub` to see available subscription management commands. To add a subscription, use `/sub add` and input the data prompted. If you would like to avoid others from seeing your zip code when using this command, DM the command to the bot."
							},
							{
								name: "About",
								value: `This bot uses the vaccinespotter.org API as well as other sources added independently.\nLearn more about this bot at ${this.links.docs}`
							}
						],
						color: 10485780,
						thumbnail: {
							url: this.bot.user.dynamicAvatarURL("png", 256)
						}
					}
				]
			}
		});
	}
}

module.exports = {Handler};