const {BaseModule} = require("../structures/BaseModule");
const { inspect } = require("util");
const fs = require("fs");
const { join } = require("path");
const links = require("../constants/Links");

class Handler extends BaseModule {
	constructor(setup) {
		super(setup);
		this.name = "textCommandHandler";
		this.event = "messageCreate";

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
							if (module.name && module.textCommand) {
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

	async handle(msg) {
		const bot = this.bot;
		const useReply = (content, file) => {
			if (typeof content === "string") {
				return bot.createMessage(msg.channel.id, {
					content,
					messageReferenceID: msg.id
				}, file);
			} else {
				return bot.createMessage(msg.channel.id, Object.assign({
					messageReferenceID: msg.id,
					allowedMentions: {
						repliedUser: false
					}
				}, content), file);
			}
		};

		const useMessage = (content, file) => {
			return bot.createMessage(msg.channel.id, content, file);
		};

		// Ignores bots and invalid channels
		if (msg.webhookID || ![0].includes(msg.channel.type) || msg.author.bot) return;
		// If the bot cannot send messages
		if (!msg.channel.memberHasPermission(bot.user.id, "sendMessages")) return;

		let cleanedMsg;
		let botCalled = false;
		if (msg.mentions[0] && (msg.content.startsWith("<@!" + bot.user.id + ">") || msg.content.startsWith("<@" + bot.user.id + ">"))) {
			if (msg.mentions[0].id === this.bot.user.id) {
				if (msg.content.startsWith("<@!" + bot.user.id + ">")) {
					cleanedMsg = msg.content.replace("<@!" + bot.user.id + ">", "").trim();
				} else {
					cleanedMsg = msg.content.replace("<@" + bot.user.id + ">", "").trim();
				}
				botCalled = true;
			}
		}
		if (!botCalled) return;
		const args = cleanedMsg.split(/ +/g).map((arg) => {
			return arg.trim();
		});
		const argsLC = cleanedMsg.split(/ +/g).map((arg) => {
			return arg.trim().toLowerCase();
		});



		// Get command
		const commandUsed = argsLC[0];
		const command = this.commands.get(commandUsed);
		if (!command) return;

		// owner only command
		if (command.ownerOnly) {
			const owners = process.env.owners.split(",").map(id => {
				return id.trim();
			});
			if (!owners.includes(msg.author.id)) {
				return useReply("This command is **bot owner only**");
			}
		}
		// user perms
		if (command.perms) {
			let missingPerms = [];
			const channel = msg.channel;
			command.perms.forEach(perm => {
				if (!channel.memberHasPermission(msg.author.id, perm)) {
					missingPerms.push(perm);
				}
			});
			if (missingPerms.length > 0) {
				return useReply("You are missing permissions required to use this command: {missing_perms}."
					.replace("{missing_perms}", missingPerms.join(", ")))
					.catch(() => {return;});
			}
		}
		// bot permissions
		if (command.botPerms) {
			let missingBotPerms = [];
			const channel = msg.channel;
			command.botPerms.forEach(perm => {
				if (!channel.memberHasPermission(this.bot.user.id, perm)) {
					missingBotPerms.push(perm);
				}
			});
			if (missingBotPerms.length > 0) {
				return useReply("The bot is missing permissions required to use this command: {missing_perms}.\nVisit {link} to learn how to fix this."
					.replace("{missing_perms}", missingBotPerms.join(", "))
					.replace("{link}", links.getStarted))
					.catch(() => {return;});
			}
		}
		

		// Run command
		const images = Object.assign(require("../constants/Images"))[commandUsed];
		try {
			return command.handle({
				msg,
				args,
				argsLC,
				commands: this.commands,
				images,
				commandUsed,
				cleanedMsg,
				useReply,
				useMessage,
				error: (e) => {
					this.err(e);
				}
			});
		} catch (e) {
			this.err(e);
		}
	}
}

module.exports = {Handler};