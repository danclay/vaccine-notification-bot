const { BaseClusterWorker } = require("eris-fleet");
const knex = require("knex");
const fs = require("fs");
const {join} = require("path");
const Eris = require("eris-additions")(require("eris"));

class BotWorker extends BaseClusterWorker {
	constructor(setup) {
		super(setup);
		this.err = console.error;
		
		this.db = knex(Object.assign({connection: process.env.DATABASE_URL}, JSON.parse(process.env.DATABASE_CONFIG)));
		
		this.modules = new Eris.Collection();
		fs.readdir("./modules/", (e, files) => {
			if (e) throw e;

			let resolveReady;
			this.ready = new Promise(resolve => {
				resolveReady = () => {
					resolve();
				};
			});
			files.forEach((file, i) => {
				if (file.endsWith(".js")) {
					const path = join(__dirname, "./modules/", file);
					const Module = require(path);
					if (Module.Handler) {
						const module = new Module.Handler(this);
						this.modules.set(module.name, module);
					}
				}
				// Adds this.modules to modules
				if (i === files.length - 1) {
					this.modules.forEach(m => {
						m.modules = this.modules;
					});
					resolveReady();
				}
			});
		});

		// Register listeners

		this.bot.on("guildCreate", (guild) => {
			this.modules.filter(m => m.event === "guildCreate").forEach(m => {
				m.handle(guild, this.modules);
			});
		});

		this.bot.on("guildDelete", (guild) => {
			this.modules.filter(m => m.event === "guildDelete").forEach(m => {
				m.handle(guild, this.modules);
			});
		});

		this.bot.on("messageCreate", (msg) => {
			this.modules.filter(m => m.event === "messageCreate").forEach(m => {
				m.handle(msg, this.modules);
			});
		});

		// raw events
		this.bot.on("rawWS", event => {
			this.modules.filter(m => m.rawWS && m.event === event.t).forEach(m => {
				m.handle(event, this.modules);
			});
		});

		// IPC
		this.ipc.command("general", "STATUS", true).then(msg => {
			this.bot.editStatus(msg.status.status, {
				name: msg.status.name,
				type: msg.status.type
			});
		});

		this.ipc.register("STATUS_UPDATE", (msg) => {
			this.bot.editStatus(msg.msg.status.status, {
				name: msg.msg.status.name,
				type: msg.msg.status.type
			});
		});

		this.ipc.register("SEND_MESSAGE", (msg) => {
			const channel = this.bot.getChannel(msg.msg.channelId);
			if (channel) {
				channel.createMessage(msg.msg.message);
			}
		});

		this.ipc.register("SEND_DM", async (msg) => {
			const channel = await this.bot.getDMChannel(msg.msg.userId);
			if (channel) {
				channel.createMessage(msg.msg.message);
			}
		});

		// Refresh blacklisted guilds
		const blacklistRefesh = async () => {
			const blacklisted = await this.db("blacklisted_guilds").select("id").catch(console.error);
			if (blacklisted) if (blacklisted[0]) {
				blacklisted.forEach(async (blacklistedGuild) => {
					const guild = this.bot.guilds.find(g => g.id === blacklistedGuild.id);
					if (guild) {
						await this.bot.leaveGuild(guild.id);
						console.log("Left blacklisted guild " + guild.id + ` (${guild.name})`);
					}
				});
			}
		};
		blacklistRefesh();
		setInterval(() => {
			blacklistRefesh();
		}, Number(process.env.blacklist_refresh));
	}
}

module.exports = {Eris, BotWorker};