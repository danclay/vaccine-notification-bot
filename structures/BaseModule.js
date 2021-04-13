class BaseModule {
	constructor(setup) {
		if (setup) {
			if (setup.bot) this.bot = setup.bot;
			if (setup.clusterID) this.clusterID = setup.clusterID;
			if (setup.workerID) this.workerID = setup.workerID;
			if (setup.ipc) this.ipc = setup.ipc;
			if (setup.db) this.db = setup.db;
			if (setup.err) this.err = setup.err;
			if (setup.serviceReady) this.serviceReady = setup.serviceReady;
			if (setup.serviceStartingError) this.serviceStartingError = setup.serviceStartingError;
			if (setup.modules) this.modules = setup.modules;
		}
	}
}

module.exports = {BaseModule};