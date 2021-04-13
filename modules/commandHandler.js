const {BaseModule} = require("../structures/BaseModule");
const { inspect } = require("util");
const fs = require("fs");
const { join } = require("path");
const links = require("../constants/Links");
const { Interaction } = require("slashy");

const Sentry = require("@sentry/node");
if (process.env.SENTRY_ENVIRONMENT !== "development" && process.env.SENTRY_ENVIRONMENT) Sentry.init();

class Handler extends BaseModule {
	constructor(setup) {
		super(setup);
		this.name = "commandHandler";
		this.rawWS = true;
		this.event = "INTERACTION_CREATE";

		this.err = (e) => {
			console.error(inspect(e));
		};

		// waits for setup to be ready
		setup.ready.then(() => {
			this.commands = new Map();
			fs.readdir(join(__dirname, "../commands/"), (e, files) => {
				if (e) throw e;
				files.forEach((file, i) => {
					if (file.endsWith(".js")) {
						const path = join(__dirname, "../commands/", file);
						const Module = require(path);
						if (Module.Handler) {
							const module = new Module.Handler(this);
							module.links = links;
							if (module.name && !module.textCommand) {
								this.commands.set(module.name, module);
							}
						}
					}
					// Adds this.commands to commands
					if (i === files.length - 1) {
						this.commands.forEach(m => {
							m.commands = this.commands;
						});
					}
				});
			});
		});
	}

	async handle(event) {
		const interaction = new Interaction(event.d, this.bot.user.id);
		// ACK ping
		if (interaction.type === 1) {
			return interaction.send({ type: 1 });
		}

		// set interaction user
		if (interaction.member) {
			interaction.user = interaction.member.user;
		}
		// basic response
		const respond = (content) => {
			interaction.send({
				type: 5,
				data: {
					flags: 64
				}
			});
			interaction.edit(content);
		};

		// error
		const error = (e, command) => {
			let errorID = "?";
			if (process.env.SENTRY_ENVIRONMENT !== "development" && process.env.SENTRY_ENVIRONMENT) {
				Sentry.withScope(function(scope) {
					scope.setUser({
						id: interaction.user.id,
						username: interaction.user.username
					});
					if (command) scope.setTag("command", command);
					scope.setExtra("text_channel", interaction.channel_id);
					errorID = Sentry.captureException(e);
				});
			} else {
				console.error(inspect(e));
			}
			if (command) {
				respond(`**Error: ** Unknown error. Error ID: ${errorID}`);
			}
		};

		// Get command
		const commandUsed = interaction.data.name;
		const command = this.commands.get(commandUsed);
		if (!command) return;

		// if the command is guild only
		if (command.guildOnly) {
			// command not used in guild
			if (!command.member) {
				return respond("**Invalid:** This command must be used from within a server");
			}
			// owner only command
			if (command.ownerOnly) {
				const owners = process.env.owners.split(",").map(id => {
					return id.trim();
				});
				if (!owners.includes(interaction.user.id)) {
					return respond("**Invalid:** This command is reserved to the bot owners");
				}
			}
			// user perms
			if (command.perms) {
				let missingPerms = [];
				const channel = await this.bot.getChannel(interaction.channel_id);
				command.perms.forEach(perm => {
					if (!channel.memberHasPermission(interaction.user.id, perm)) {
						missingPerms.push(perm);
					}
				});
				if (missingPerms.length > 0) {
					return respond("You are missing permissions required to use this command: {missing_perms}."
						.replace("{missing_perms}", missingPerms.join(", ")))
						.catch(() => {return;});
				}
			}
			// bot permissions
			if (command.botPerms) {
				let missingBotPerms = [];
				const channel = await this.bot.getChannel(interaction.channel_id);
				command.botPerms.forEach(perm => {
					if (!channel.memberHasPermission(this.bot.user.id, perm)) {
						missingBotPerms.push(perm);
					}
				});
				if (missingBotPerms.length > 0) {
					return respond("The bot is missing permissions required to use this command: {missing_perms}.\nVisit {link} to learn how to fix this."
						.replace("{missing_perms}", missingBotPerms.join(", "))
						.replace("{link}", links.getStarted))
						.catch(() => {return;});
				}
			}
		}

		// Run command
		const images = Object.assign(require("../constants/Images"))[commandUsed];
		try {
			return command.handle({
				interaction,
				commands: this.commands,
				images,
				respond,
				error: (e) => {
					error(e, commandUsed);
				}
			});
		} catch (e) {
			error(e);
		}
	}
}

module.exports = {Handler};