const {BaseServiceWorker} = require("eris-fleet");
const knex = require("knex");
const fs = require("fs");
const {join} = require("path");
const {inspect} = require("util");
const Eris = require("eris");

module.exports = class ServiceWorker extends BaseServiceWorker {
	constructor(setup) {
		super(setup);
		this.db = knex(Object.assign({connection: process.env.DATABASE_URL}, JSON.parse(process.env.DATABASE_CONFIG)));
		this.err = (e) => {
			console.error(inspect(e));
		};

		// Modules
		this.modules = new Eris.Collection();
		fs.readdir(join(__dirname, "./generalModules/"), (e, files) => {
			if (e) throw e;
			files.forEach((file, i) => {
				if (file.endsWith(".js")) {
					const path = join(__dirname, "./generalModules/", file);
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
					this.serviceReady();
				}
			});
		});
	}

	async handleCommand(req) {
		let op;
		if (typeof req === "string") {
			op = req;
		} else {
			op = req.op;
		}
		const modules = this.modules.filter(m => m.op === op);
		if (modules.length === 1) {
			return await modules[0].handle(req);
		} else {
			return {err: "Unknown request", req};
		}
	}
};