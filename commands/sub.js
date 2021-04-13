const {BaseModule} = require("../structures/BaseModule");
const subscriptionsTable = "user_location_subscriptions";
const notificationsTable = "user_notifications";

class Handler extends BaseModule {
	constructor(setup) {
		super(setup);
		this.name = "sub";
	}

	handle(data) {
		const interaction = data.interaction;
		const subCommand = interaction.data.options[0].name;
		if (this[subCommand]) {
			// ACK interaction and set to ephemeral
			/*interaction.send({
				type: 5,
				data: {
					flags: 64
				}
			});*/
			return this[subCommand](data);
		}
		return data.respond("**Error:** Command does not exist.");
	}

	async add(data) {
		const interaction = data.interaction;
		const addOptions = interaction.data.options.find(option => option.name === "add");
		if (!addOptions) {
			return data.respond("❌ **Error:** Command does not exist. (subcommand options do not exist)");
		}
		const options = addOptions.options;

		const radiusOption = options.find(option => option.name === "radius");
		let radius = 15;
		if (radiusOption) {
			radius = Number(radiusOption.value);
		}
		if (radius < 1 || radius > 100) {
			return data.respond("❌ **Invalid:** Radius must be an integer between 1 and 100"); 
		}

		const wholeStateOption = options.find(option => option.name === "whole_state");
		if (wholeStateOption) {
			if (wholeStateOption.value) {
				radius = -1;
			}
		}

		const secondDoseOption = options.find(option => option.name === "2nd_dose");
		let secondDose = false;
		if (secondDoseOption) {
			secondDose = secondDoseOption.value;
		}

		const providerWhitelistOption = options.find(option => option.name === "provider_whitelist");
		let providerWhitelist;
		if (providerWhitelistOption) {
			let invalid = false;
			const mapFunc = (v) => {
				const newVal = v.trim().toLowerCase();
				if (newVal.length > 100) {
					invalid = true;
				}
				return newVal;
			};
			providerWhitelist = providerWhitelistOption.value.split(",").map(mapFunc);
			if (invalid) {
				return data.respond("❌**Invalid:** Each provider name can only be up to 100 characters long");
			}
		}

		const providerBlacklistOption = options.find(option => option.name === "provider_blacklist");
		let providerBlacklist;
		if (providerBlacklistOption) {
			let invalid = false;
			const mapFunc = (v) => {
				const newVal = v.trim().toLowerCase();
				if (newVal.length > 100) {
					invalid = true;
				}
				return newVal;
			};
			providerBlacklist = providerBlacklistOption.value.split(",").map(mapFunc);
			if (invalid) {
				return data.respond("❌**Invalid:** Each provider name can only be up to 100 characters long");
			}
		}

		const zipOption = options.find(option => option.name === "zip");
		if (!zipOption) {
			return data.respond("❌ **Error:** Zip value does not exist. (subcommand zip option does not exist)");
		}
		const zip = String(zipOption.value);
		if (zip.length !== 5) {
			return data.respond("❌ **Invalid:** Zip must be 5 digits");
		}
		const zipData = await this.ipc.command("general", {op: "vaccineChecker", data: {op: "getZipData", zip}}, true);
		if (zipData === null) {
			return data.respond("❌ **Invalid:** Zip code does not exist");
		}

		const dmChannel = await this.bot.getDMChannel(interaction.user.id);
		if (!dmChannel) {
			return data.respond("❌ **Error:** Cannot get your DM channel");
		}

		// Start transaction
		this.db(subscriptionsTable)
			.where("id", interaction.user.id)
			.count()
			.then(count => {
				count = Number(count[0].count);
				const maxSubs = Number(process.env.max_subs);
				if (count + 1 > maxSubs) {
					return data.respond(`❌ **Error:** You are using ${count} of ${maxSubs} subscriptions.`);
				}
				this.db.transaction(trx => {
					this.db(subscriptionsTable)
						.transacting(trx)
						.insert({
							id: interaction.user.id,
							zip,
							radius,
							provider_whitelist: providerWhitelist,
							provider_blacklist: providerBlacklist,
							second_dose: secondDose,
							state: zipData.state,
							dm_channel_id: dmChannel.id
						})
						.onConflict(["id", "zip"])
						.merge()
						.returning("*")
						.then(trx.commit)
						.catch(trx.rollback);
				})
					.then(r => {
						r = r[0];
						const rows = [
							`**Zip:** ${r.zip}`,
							`**State:** ${r.state}`,
							"**Radius:** " + (r.radius === -1 ? "Whole state" : `${r.radius} miles`),
							`**2nd Dose:** ${r.second_dose}`
						];
						if (r.provider_whitelist) rows.push("**Provider Whitelist:** " + r.provider_whitelist.join(", "));
						if (r.provider_blacklist) rows.push("**Provider Blacklist:** " + r.provider_blacklist.join(", "));
						return data.respond(`✅ A subscription has been added:\n${rows.join("\n")}\nYou will be notified when availabilities are detected`);
					}).catch(data.error);
			}).catch(data.error);
	}

	remove(data) {
		const interaction = data.interaction;
		const removeOptions = interaction.data.options.find(option => option.name === "remove");
		if (!removeOptions) {
			return data.respond("**Error:** Command does not exist. (subcommand options do not exist)");
		}
		const options = removeOptions.options;

		const zipOption = options.find(option => option.name === "zip");
		if (!zipOption) {
			return data.respond("**Error:** Zip value does not exist. (subcommand zip option does not exist)");
		}
		const zip = String(zipOption.value);
		if (zip.length !== 5) {
			return data.respond("**Invalid:** Zip must be 5 digits");
		}

		this.db(subscriptionsTable)
			.where("id", data.interaction.user.id)
			.where("zip", zip)
			.del()
			.then((deleted) => {
				if (deleted) {
					data.respond(`🗑️ Removed subscription for zip code **${zip}**.`);
				} else {
					data.respond(`❌ You didn't have a subscription for zip code **${zip}**.`);
				}
			}).catch(data.error);
	}

	clear(data) {
		this.db(subscriptionsTable)
			.where("id", data.interaction.user.id)
			.del()
			.then((deleted) => {
				this.db(notificationsTable)
					.where("id", data.interaction.user.id)
					.del()
					.then(() => {
						if (deleted) {
							data.respond("🗑️ Removed all subscription data. You will not longer recieve direct message notifications.");
						} else {
							data.respond("❌ You didn't have any subscriptions.");
						}
					}).catch(console.error);
			}).catch(console.error);
	}

	list(data) {
		this.db(subscriptionsTable)
			.where("id", data.interaction.user.id)
			.select("*")
			.then((results) => {
				if (results.length === 0) {
					return data.respond("You have no subscriptions. Use `/sub add` to add one.");
				}
				const subs = results.map(v => {
					const rows = [
						`**Zip:** ${v.zip}`,
						`**State:** ${v.state}`,
						"**Radius:** " + (v.radius === -1 ? "Whole state" : `${v.radius} miles`),
						`**2nd Dose:** ${v.second_dose}`
					];
					if (v.provider_whitelist) rows.push("**Provider Whitelist:** " + v.provider_whitelist.join(", "));
					if (v.provider_blacklist) rows.push("**Provider Blacklist:** " + v.provider_blacklist.join(", "));
					return rows.join("\n");
				});

				return data.respond(`**__Your Subscriptions__**\nUsing ${results.length} of ${process.env.max_subs} subscriptions\n*Make sure the bot can send you direct messages and that you have direct message notifications enabled.*\n${subs.join("\n\n")}`);
			}).catch(data.error);
	}

	pause(data) {
		const interaction = data.interaction;
		const pauseOptions = interaction.data.options.find(option => option.name === "pause");
		if (!pauseOptions) {
			return data.respond("**Error:** Command does not exist. (subcommand options do not exist)");
		}
		const options = pauseOptions.options;

		const pausedOption = options.find(option => option.name === "paused");
		if (!pausedOption) {
			return data.respond("**Error:** pause value does not exist. (subcommand pause option does not exist)");
		}
		const paused = Boolean(pausedOption.value);
		this.db(subscriptionsTable)
			.where("id", data.interaction.user.id)
			.update({ paused })
			.then(() => {
				return data.respond(paused ? "⏸️ Your subscription notifications have been paused." : "✅ Your subscription notifications have been resumed.");
			})
			.catch(data.error);
	}
}

module.exports = {Handler};