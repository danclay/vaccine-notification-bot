const {BaseModule} = require("../structures/BaseModule");
const {inspect} = require("util");

class Handler extends BaseModule {
	constructor(setup) {
		// Admin command
		super(setup);
		this.name = "control";
		this.ownerOnly = true;
		this.textCommand = true;
	}
	async handle(info) {
		const msg = info.argsLC[1];
		const reply = info.useReply;
		if (msg == "totalshutdown") {
			reply("Total shutdown");
			this.ipc.totalShutdown(Boolean(info.args[2]));
		} else if (msg == "restartallclusters") {
			reply("Restarting all clusters");
			this.ipc.restartAllClusters(Boolean(info.args[2]));
		} else if (msg == "restartcluster") {
			reply(`Restarting cluster ${Number(info.args[2])}`);
			this.ipc.restartCluster(Number(info.args[2]), Boolean(info.args[3]));
		} else if (msg == "restartservice") {
			reply(`Restarting service ${info.args[2]}`);
			this.ipc.restartService(info.args[2], Boolean(info.args[3]));
		} else if (msg == "restartallservices") {
			reply("Restarting all services");
			this.ipc.restartAllServices(Boolean(info.args[2]));
		} else if (msg == "reshard") {
			reply("Resharding");
			this.ipc.reshard();
		} else if (msg == "serviceping") {
			const start = new Date();
			await this.ipc.command("stats", null, true);
			reply(new Date() - start + " ms");
		} else if (msg == "stats") {
			reply(inspect(await this.ipc.getStats()));
		} else if (msg == "mm") {
			this.maintienceMode = !this.maintienceMode;
			reply("Maintience mode is now set to " + this.maintienceMode);
		} else if (msg == "d") {
			reply("Restarting cluster 0");
			this.ipc.restartCluster(0, true);
		} else if (msg == "s") {
			this.ipc.totalShutdown();
		} else if (msg == "error") {
			info.error(new Error("test"));
		} else if (msg == "fetchguild") {
			const guild = await this.ipc.fetchGuild(info.args[2]);
			reply(inspect(guild));
		} else if (msg == "fetchmember") {
			const member = await this.ipc.fetchMember(info.args[2], info.args[3]);
			reply(inspect(member));
		} else if (msg == "fetchuser") {
			const user = await this.ipc.fetchUser(info.args[2]);
			reply(inspect(user));
		} else if (msg == "fetchchannel") {
			const channel = await this.ipc.fetchChannel(info.args[2]);
			reply(inspect(channel));
		} else reply("```totalShutdown[hard]\nrestartAllClusters[hard]\nrestartCluster<id>[hard]\nrestartService<name>[hard]\nrestartAllServices[hard]\nreshard\nservicePing\nmm\ndisable <command> <message>\nenable <command>\ngenKeys <number to gen> <boosts> [hours till expire]\nfetchGuild <id>\nfetchMember <guild id> <user id>\nfetchUser <user id>\nfetchChannel <channel id>\nfetchMember <guild id> <user id>\nfetchUser <user id>\noutage <msg>```");
	}
}

module.exports = {Handler};