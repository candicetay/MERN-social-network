const express = require("express");
const connectDB = require("./config/db");
const { generateKeyPairSync } = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

//Check if RSA Keypair has been created, else create & save to config
if (
	!(
		fs.existsSync(path.join(__dirname, "config", "id_rsa_pub.pem")) &&
		fs.existsSync(path.join(__dirname, "config", "id_rsa_priv.pem"))
	)
) {
	try {
		const { publicKey, privateKey } = generateKeyPairSync("rsa", {
			modulusLength: 4096,
			publicKeyEncoding: {
				type: "spki",
				format: "pem",
			},
			privateKeyEncoding: {
				type: "pkcs8",
				format: "pem",
				cipher: "aes-256-cbc",
				passphrase: "secretPass_",
			},
		});

		const configdefaultjson = fs.readFileSync(
			path.join(__dirname, "config", "default.json"),
			"utf-8"
		);

		const configjson = JSON.parse(configdefaultjson);
		configjson["passphrase"] = "secretPass_";
		configjson["jwt_rsa_publicKey"] = publicKey;
		configjson["jwt_rsa_privateKey"] = privateKey;

		fs.writeFileSync(
			path.join(__dirname, "config", "default.json"),
			JSON.stringify(configjson),
			"utf-8"
		);

		fs.writeFileSync(
			path.join(__dirname, "config", "id_rsa_pub.pem"),
			publicKey,
			"utf8"
		);
		fs.writeFileSync(
			path.join(__dirname, "config", "id_rsa_priv.pem"),
			privateKey,
			"utf8"
		);
		console.log("RSA Keypair generated");
	} catch (err) {
		console.log(err);
		console.log("Issue with Saving and Generating RSA Keypair");
	}
}

//Connect Database
connectDB();

//Initialize middleware
app.use(express.json());

app.get("/", (req, res) => res.send("API Running"));

//Define Routes
app.use("/api/users", require("./routes/api/users"));
app.use("/api/posts", require("./routes/api/posts"));
app.use("/api/auth", require("./routes/api/auth"));
app.use("/api/profile", require("./routes/api/profile"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
