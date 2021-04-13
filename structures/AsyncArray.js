class AsyncArray extends Array {
	constructor() {
		if (Array.isArray(arguments[0])) {
			super(...arguments[0]);
		} else {
			super(arguments);
		}
	}

	forEach(predicate) {
		return new Promise((resolve) => {
			const loop = async (i) => {
				if (i >= this.length) {
					resolve();
					return;
				}
				await predicate(this[i], i);
				loop(i + 1);
			};
			loop(0);
		});
	}

	filter(predicate) {
		return new Promise((resolve) => {
			const array = [];
			const loop = async (i) => {
				if (i >= this.length) {
					return resolve(array);
				}
				const result = await predicate(this[i], i);
				if (result) {
					array.push(this[i]);
				} 
				loop(i + 1);
			};
			loop(0);
		});
	}

	map(predicate) {
		return new Promise((resolve) => {
			const array = [];
			const loop = async (i) => {
				if (i >= this.length) {
					return resolve(array);
				}
				const result = await predicate(this[i], i);
				if (result) {
					array.push(result);
				} 
				loop(i + 1);
			};
			loop(0);
		});
	}
}

module.exports = {AsyncArray};