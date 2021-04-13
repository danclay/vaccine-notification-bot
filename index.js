const { isMaster } = require("cluster");
const { Fleet } = require("eris-fleet");
const {join} = require("path");
const { inspect } = require("util");
const log = require("fancy-log");
const fs = require("fs");
const axios = require("axios");

require("dotenv").config();

fs.readdir(join(__dirname, "./services/"), (err, files) => {
	if (err) throw err;
	let services = [];
	files.forEach(file => {
		if (file.endsWith(".js")) {
			services.push({name: file.replace(".js", ""), path: join(__dirname, "./services/", file)});
		}
	});
	const options = Object.assign(JSON.parse(process.env.SHARDER_OPTIONS), {
		path: join(__dirname, "./bot.js"),
		services,
		startingStatus: {
			status: "dnd",
			game: {name: "Starting up..."}
		},
		objectLogging: true
	});
	const Admiral = new Fleet(options);

	if (isMaster) {
		const Sentry = require("@sentry/node");

		if (process.env.SENTRY_ENVIRONMENT !== "development" && process.env.SENTRY_ENVIRONMENT) Sentry.init();
		Admiral.on("log", m => {
			let message = m.message;
			if (typeof m.message === "object") {
				message = inspect(m.message);
			}
			log(m.source + " | " + message);
		});
		Admiral.on("debug", m => {
			let message = m.message;
			if (typeof m.message === "object") {
				message = inspect(m.message);
			}
			log.info(m.source + " | " + message);
		});
		Admiral.on("warn", m => {
			let message = m.message;
			if (typeof m.message === "object") {
				message = inspect(m.message);
			}
			log.warn(m.source + " | " + message);
		});
		Admiral.on("error", m => {
			if (m.source === "Admiral" || m.source.includes("service")) {
				if (process.env.SENTRY_ENVIRONMENT !== "development" && process.env.SENTRY_ENVIRONMENT) {
					Sentry.captureException(m.message);
				}
			}
			if (process.env.SENTRY_ENVIRONMENT === "development") {
				let message = m.message;
				if (typeof m.message === "object") {
					message = inspect(m.message);
				}
				log.error(m.source + " | " + message);
			}
		});

		//Admiral.once("ready", () => console.log("ha"))
	}
});