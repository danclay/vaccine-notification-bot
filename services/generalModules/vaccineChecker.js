const {BaseModule} = require("../../structures/BaseModule");
const axios = require("axios");
const { AsyncArray } = require("../../structures/AsyncArray");
const geodist = require("geodist");
const cityTimezones = require("city-timezones");
const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();
const botToken = JSON.parse(process.env.SHARDER_OPTIONS).token;

class Handler extends BaseModule {
	constructor(setup) {
		super(setup);
		this.name = "vaccineChecker";
		this.op = "vaccineChecker";

		this.checkVaccineApi();
		setInterval(() => {
			this.checkVaccineApi();
		}, new Number(process.env.vaccine_interval));
	}

	// handle ipc command
	async handle(req) {
		const data = req.data;
		const op = data.op;
		if (op === "getZipData") {
			const zipData = await this.getZipData(data.zip);
			return zipData || null;
		}
		return {err: "invalid op"};
	}

	async getZipData(zip) {
		const remoteDataset = false;
		let result;
		if (remoteDataset) {
			// fetch remote dataset
			const params = {
				dataset: "us-zip-code-latitude-and-longitude",
				q: zip,
				rows: 1,
				facet: ["state", "timezone", "geopoint"]
			};
			result = await axios.get("https://public.opendatasoft.com/api/records/1.0/search", { params }).catch(this.err);
		} else {
			// local dataset
			const zipCodeDataset = require("../../constants/zipCodeDataset.json");
			result = {data: {records: [zipCodeDataset.find(v => v.fields.zip === zip)]}};
		}
		if (!result) return;
		const data = result.data;
		const record = data.records[0];
		if (!record) return;
		const fields = record.fields;
		if (fields.zip !== zip) return;
		return fields;
	}

	async isCvsAcceptingAppointments() {
		let error;
		await axios.get("https://www.cvs.com/vaccine/intake/store/cvd-schedule?icid=coronavirus-lp-vaccine-sd-statetool").catch((e) => error = e);
		if (error) {
			if (error.response) {
				if (Number(error.response.status) === 503) return false;
			}
		}
		return true;
	}

	truncateString(str, n) {
		return (str.length > n) ? str.substr(0, n - 1) : str;
	}

	async checkVaccineApi() {
		console.log("Starting vaccine API fetch");
		// check if cvs is accepting appointments
		const cvsAcceptingAppointments = await this.isCvsAcceptingAppointments();
		console.log("Is CVS accepting appointments: " + cvsAcceptingAppointments);
		const subscriptionsTable = "user_location_subscriptions";
		const notificationsTable = "user_notifications";
		this.db(subscriptionsTable)
			.where("paused", false)
			.select("*")
			.then(async (rows) => {
				const states = new AsyncArray(rows.filter((row, i) => i === rows.findIndex(r => r.state === row.state)).map(v => v.state));
				await states.forEach(async (state) => {
					const response = await axios.get(`https://www.vaccinespotter.org/api/v0/states/${state.toUpperCase()}.json`).catch(console.error);
					if (!response) return;
					console.log("Fetched API data for " + state);
					const data = response.data;
					if (!data) return console.error("no state response data");
					let features = data.features;
					if (!features) return console.error("no state features data");
					features = features.filter(v => v.properties.appointments_available === true && v.properties.carries_vaccine === true);
					
					// send notifications
					await new AsyncArray(rows.filter(v => v.state === state)).forEach(async (row) => {
						// get previous notifications first
						const notificationRows = await this.db(notificationsTable)
							.select(["sent_timestamp", "location_id", "appointments_last_modified"])
							.where("id", row.id)	
							.catch(console.error);

						if (!notificationRows) return;
						// remove events not ready for notifications yet
						const notificationFilteredFeautures = features.filter(v => {
							const props = v.properties;
							// remove cvs if cvs is not accepting appointments
							if (props.provider === "cvs" && !cvsAcceptingAppointments) return false;

							const found = notificationRows.find(n => Number(props.id) === Number(n.location_id));
							if (!found) return true;
							// remove less than min notification wait time
							if (new Date(found.sent_timestamp).getTime() + Number(process.env.notification_timeout) > new Date().getTime()) {
								return false;
							}
							// remove if appointments have not been modified
							if (new Date(found.appointments_last_modified).getTime() >= new Date(props.appointments_last_modified).getTime()) {
								return false;
							}
							return true;
						});

						const rowFilteredFeatures = notificationFilteredFeautures.filter(v => {
							const props = v.properties;
							let checksPassed = 0;
							if (row.provider_whitelist) {
								if (row.provider_whitelist.includes(props.provider)) {
									checksPassed++;
								}
							} else {
								checksPassed++;
							}

							if (row.provider_blacklist) {
								if (!row.provider_blacklist.includes(props.provider)) {
									checksPassed++;
								}
							} else {
								checksPassed++;
							}

							if (!(!row.second_dose && props.appointments_available_2nd_dose_only)) {
								checksPassed++;
							}
	
							if (checksPassed === 3) {
								return true;
							} else {
								return false;
							}
						});

						let validFeatures = new AsyncArray(rowFilteredFeatures);

						// if specified radius
						if (row.radius !== -1) {
							validFeatures = await validFeatures.map(async (v) => {
								const zipData = await this.getZipData(row.zip);
								if (!zipData) return;

								const featureGeometry = v.geometry.coordinates;

								const zipGeo = {lat: Number(zipData.latitude), lon: Number(zipData.longitude)};
								const locationGeo = {lat: Number(featureGeometry[1]), lon: Number(featureGeometry[0])};
								const distance = geodist(zipGeo, locationGeo, {unit: "mi"});
								if (distance > row.radius) return;
								return Object.assign(v, { distance });
							});

							validFeatures.sort((a, b) => a.distance - b.distance);
						}

						const bundledMessageDesc = [];
						//const bundledMessageFields = [];
						const notifiedFeatures = [];
						await validFeatures.forEach(feature => {
							const props = feature.properties;
							let timezone = props.time_zone;
							if (!timezone || timezone === null) {
								const cityData = cityTimezones.findFromCityStateProvince(props.city + " " + props.state);
								if (cityData.length > 0) {
									timezone = cityData[0].timezone;
								} else {
									timezone = "America/New_York";
								}
							}
								
							const dateOptions = {
								timeZone: timezone,
								year: "numeric",
								month: "numeric",
								day: "numeric",
								hour: "numeric",
								minute: "numeric"
							};
						
							const googleMapsUrl = `https://www.google.com/maps/search/${String(props.address).split(" ").join("+")},+${props.postal_code}`;

							const featureDescSections = [
								`As of ${(new Date(props.appointments_last_fetched)).toLocaleString([], dateOptions)}`,
								`[${props.address}](${googleMapsUrl})`,
								`[**Book**](${props.url})`
							];
							if (feature.distance) {
								featureDescSections.splice(1, 0, `${feature.distance} miles`);
							}
							bundledMessageDesc.push(`**${props.provider_brand_name} (${props.provider}) in ${props.city}, ${props.state}:** ` + featureDescSections.join(" | "));
							notifiedFeatures.push(feature);
						});
						if (bundledMessageDesc.length === 0) return;
						/*const viewInBrowserUrl = process.env.view_in_browser_url
							.replace("{state}", state)
							.replace("{features}", notifiedFeatures.map(v => encodeURIComponent(JSON.stringify({d: v.distance, id: v.properties.id}))).join(",,"));
						console.log(viewInBrowserUrl.length);*/
						const truncateDesc = (array, i, trucated) => {
							const truncatedIndicator = (trucated ? "\n..." : "");
							if ((array.join("\n") + truncatedIndicator).length > 2048) {
								array.splice(-1, 1);
								return truncateDesc(array, i - 1, true);
							}
							return array.join("\n")  + truncatedIndicator;
						};

						oauth.request("POST", `/channels/${row.dm_channel_id}/messages`, {
							content: `‼️ **${state}:** Vaccine appointments available near zip code ${row.zip}`,
							embed: {
								title: "Appointments",
								description: `${truncateDesc(bundledMessageDesc, bundledMessageDesc.length - 1)}`,
								fields: [
									{
										name: "View Appointments",
										value: `[View on vaccinespotter.org](https://www.vaccinespotter.org/${state}/?zip=${row.zip}${row.radius === -1 ? "" : `&radius=${row.radius}`}#zip)`
									}
								],
								footer: {
									text: "Data provided by vaccinespotter.org"
								}
							}
						}, {
							auth: {
								type: "Bot",
								creds: botToken
							},
							contentType: "application/json"
						})
							.then(() => {
								// add notification records
								notifiedFeatures.forEach(feature => {
									const props = feature.properties;
									this.db(notificationsTable)
										.insert({
											id: row.id,
											location_id: props.id,
											sent_timestamp: new Date(),
											appointments_last_modified: new Date(props.appointments_last_modified)
										})
										.onConflict(["id", "location_id"])
										.merge()
										.catch(console.error);
								});
							})
							.catch(() => {return;});
						// commented out since this was spammy 
						/*if (bundledMessageFields.length === 0) return;
						console.log(bundledMessageFields.length);
						const fieldPages = [];
						const paginator = (i, nextPageI, pageFields) => {
							if (!bundledMessageFields[i]) {
								if (pageFields.length > 0) {
									fieldPages.push(pageFields);
								}
								return;
							}
							pageFields.push(bundledMessageFields[i]);
							if (i === nextPageI) {
								nextPageI = i + 25;
								fieldPages.push(pageFields);
								pageFields = [];
							}
							paginator(i + 1, nextPageI, pageFields);
						};
						paginator(0, 25, []);
						
						fieldPages.forEach((pageFields, i) => {
							oauth.request("POST", `/channels/${row.dm_channel_id}/messages`, {
								content: `‼️ **${state}:** Vaccine appointments available (Page ${i} of ${fieldPages.length - 1})`,
								embed: {
									title: "Appointments",
									description: `Sites are within ${row.radius} miles of ${row.zip}\n[View all appointments](https://www.vaccinespotter.org/AZ/?zip=${row.zip}${row.radius === -1 ? "" : `&radius=${row.radius}`})`,
									footer: {
										text: "Data provided by vaccinespotter.org"
									},
									fields: pageFields
								}
							}, {
								auth: {
									type: "Bot",
									creds: botToken
								},
								contentType: "application/json"
							})
								.then(() => {
									// add notification records
									notifiedFeatures.forEach(props => {
										this.db(notificationsTable)
											.insert({
												id: row.id,
												location_id: props.id,
												sent_timestamp: new Date(),
												appointments_last_modified: new Date(props.appointments_last_modified)
											})
											.onConflict(["id", "location_id"])
											.merge()
											.catch(console.error);
									});
								})
								.catch(console.error);
						});*/
					});
					console.log("Sent all notifications for " + state);
				});
			}).catch(console.error);
	}
}

module.exports = {Handler};