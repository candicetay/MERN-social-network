const express = require("express");
const router = express.Router();

const auth = require("../../middleware/auth");
const User = require("../../models/User");
const { check, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const config = require("config");
const bcrypt = require("bcryptjs");

//@route GET api/auth
//@desc Test Route
//@access Public

router.get("/", auth, async (req, res) => {
	try {
		const user = await User.findById(req.user.id, "-password"); //exclude password
		res.json(user);
	} catch (err) {
		console.error(err.message);
		res.status(500).send("Server Error");
	}
});

//@route POST api/auth
//@desc Authenticate user & get token
//@access Public

router.post(
	"/",
	[
		check("email", "Please include a valid email").isEmail(),
		check("password", "Password is required").exists(),
	],
	async (req, res) => {
		//console.log(req.body);

		//extracts validation errors from a request and makes them available in a result object
		const errors = validationResult(req);
		//Check for errors
		if (!errors.isEmpty()) {
			//send bad request error response
			return res.status(400).json({ errors: errors.array() });
		}

		const { email, password } = req.body;

		try {
			let user = await User.findOne({ email: email });

			//check if there is a user
			if (!user) {
				return res
					.status(400)
					.json({ errors: [{ msg: "Invalid credentials" }] });
				//to prevent error from >1 res status
			}

			//compares plain text password and encrypted password
			//Could pose a security risk if you tell people that "user does not exist, password wrong"
			const isMatch = await bcrypt.compare(password, user.password);
			if (!isMatch) {
				return res
					.status(400)
					.json({ errors: [{ msg: "Invalid credentials" }] });
			}

			const payload = {
				user: {
					id: user.id,
				},
			};

			//jwt token returned back is different from token from registering users
			//but if you use the same jwt token for Get auth in api/auth,
			//return same user because payload data is the same (userid)
			/*jwt.sign(
				payload,
				config.get("jwtSecret"),
				{ expiresIn: 3600 },
				(err, token) => {
					if (err) throw err;
					res.json({ token });
				}
			);*/

			jwt.sign(
				payload,
				{
					key: config.get("jwt_rsa_privateKey"),
					passphrase: config.get("passphrase"),
				},
				{ expiresIn: 3600, algorithm: "RS256" },
				(err, token) => {
					if (err) throw err;
					res.json({ token });
				}
			);
		} catch (err) {
			console.error(err.message);
			res.status(500).send("Server error");
		}
	}
);
module.exports = router;
