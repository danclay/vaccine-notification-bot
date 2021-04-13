const {BaseModule} = require("../../structures/BaseModule");
const fs = require("fs");
const {join} = require("path");

const statusEnd = " | /help";

class Handler extends BaseModule {
	constructor(setup) {
		super(setup);
		// Makes the bot status the same across clusters
		this.name = "statuses";
		this.op = "STATUS";

		const run = () => {
			fs.readFile(join(__dirname, "../../constants/Statuses.json"), (e, file) => {
				if (e) {
					this.err(e);
					return;
				}
				const json = JSON.parse(file);
				const setStatus = (newStatus) => {
					let status = {
						name: newStatus.name + statusEnd,
						status: newStatus.status || "online",
						type: newStatus.type || 0
					};
					this.footer = newStatus.footer;
					if (!this.footer) {
						this.footer = newStatus.name;
					}
					this.status = status;
					this.ipc.broadcast("STATUS_UPDATE", {
						status,
						footer: this.footer
					});
				};
				if (json.override.name) {
					setStatus(json.override);
				} else {
					const cycle = json.cycle;
					setStatus(cycle[Math.floor(Math.random() * cycle.length)]);
				}
			});
		};
		setInterval(() => {
			run();
		}, Number(process.env.status_refresh));

		run(); // Initial run
	}

	handle() {
		return {
			footer: this.footer,
			status: this.status
		};
	}
}

module.exports = {Handler};