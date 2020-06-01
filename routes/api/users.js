const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");

const User = require("../../models/User");
const gravatar = require("gravatar");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("config");

//@route POST api/users
//@desc Register users
//@access Public

router.post(
	"/",
	[
		check("name", "Name is required").not().isEmpty(),
		check("email", "Please include a valid email").isEmail(),
		check(
			"password",
			"Please enter a password of 6 or more characters"
		).isLength({ min: 6 }),
	],
	async (req, res) => {
		//console.log(req.body);

		//extracts validation errors from a request and makes them available in a result object
		const errors = validationResult(req);

		if (!errors.isEmpty()) {
			//send bad request error response
			return res.status(400).json({ errors: errors.array() });
		}

		const { name, email, password } = req.body;
		//asyncawait so must label, req, res as async
		try {
			let user = await User.findOne({ email: email });

			if (user) {
				return res
					.status(400)
					.json({ errors: [{ msg: "User already exists" }] });
				//to prevent error from >1 res status
			}

			const avatar = gravatar.url(email, {
				s: "200",
				r: "pg",
				d: "mm",
			});

			//create new user instance, encrypt password and save to database

			user = new User({
				name,
				email,
				avatar,
				password,
			});

			const salt = await bcrypt.genSalt(10); //pass the rounds
			//hash created and put into password
			user.password = await bcrypt.hash(password, salt);
			//add await cos saving the user returns a promise
			await user.save();

			//res.send("User registered");
			//mongoose abstraction so can access _id with .id
			const payload = {
				user: {
					id: user.id,
				},
			};

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
