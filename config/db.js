const mongoose = require("mongoose");
const config = require("config");
const db = config.get("mongoURI");

//asynchronous arrow function
const connectDB = async () => {
	//try catch block to debug?
	try {
		await mongoose.connect(db, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
			useCreateIndex: true,
		});
		console.log("MongoDB Connected...");
	} catch (err) {
		console.log(err.message);
		//error has a message property
		//Exit process with failure
		process.exit(1);
	}
};
module.exports = connectDB;
