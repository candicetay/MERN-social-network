const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const Profile = require("../../models/Profile");
const User = require("../../models/User");
const { check, validationResult } = require("express-validator");
const axios = require("axios");
const config = require("config");

//@route GET api/profile/me
//@desc Get current users profile
//@access Private

//user here pertains to ProfileSchema user field which is the objectid of the user
//also populate the query with avatar and name (User Model) so use method Populate to add to query

router.get("/me", auth, async (req, res) => {
	try {
		const profile = await Profile.findOne({
			user: req.user.id,
		}).populate("user", ["name", "avatar"]);
		console.log(profile);

		if (!profile) {
			return res.status(400).json({ msg: "There is no profile for this user" });
		}

		res.json(profile);
	} catch (err) {
		console.error(err.message);
		res.status(500).send("Server Error");
	}
});

//@route POST api/profile
//@desc Create or update a user profile
//@access Private

//check for body errors, check if things are coming in before setting it
//creates another collection in db (profile)
router.post(
	"/",
	[
		auth,
		[
			check("status", "Status is required").not().isEmpty(),
			check("skills", "Skills is required").not().isEmpty(),
		],
	],

	async (req, res) => {
		const errors = validationResult(req);

		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const {
			company,
			website,
			location,
			bio,
			status,
			githubusername,
			skills,
			youtube,
			facebook,
			twitter,
			instagram,
			linkedin,
		} = req.body;

		//Build profile objects

		const profileFields = {};
		profileFields.user = req.user.id;
		if (company) profileFields.company = company;
		if (website) profileFields.website = website;
		if (location) profileFields.location = location;
		if (bio) profileFields.bio = bio;
		if (status) profileFields.status = status;
		if (githubusername) profileFields.githubusername = githubusername;
		if (skills) {
			profileFields.skills = skills.split(",").map((skill) => skill.trim());
		}

		//Build social object
		profileFields.social = {};
		if (youtube) profileFields.social.youtube = youtube;
		if (twitter) profileFields.social.twitter = twitter;
		if (facebook) profileFields.social.facebook = facebook;
		if (linkedin) profileFields.social.linkedin = linkedin;
		if (instagram) profileFields.social.instagram = instagram;

		//Update and Insert data
		//3rd parameter-> changes the default so that it returns the document AFTER update is applied

		try {
			let profile = await Profile.findOne({ user: req.user.id });

			//Update
			if (profile) {
				profile = await Profile.findOneAndUpdate(
					{ user: req.user.id },
					{ $set: profileFields },
					{ new: true }
				);
				return res.json(profile);
			}

			//Create new profile
			profile = new Profile(profileFields);
			await profile.save();
			res.json(profile);
		} catch (err) {
			console.error(err.message);
			res.status(500).send("Server Error");
		}
	}
);

//@route GET api/profile
//@desc Get all profiles
//@access Public

//returns an array of profiles (with some user data)
router.get("/", async (req, res) => {
	try {
		const profiles = await Profile.find().populate("user", ["name", "avatar"]);
		res.json(profiles);
	} catch (error) {
		console.error(error.message);
		res.status(500).send("Server Error");
	}
});

//@route GET api/profile/user/:user_id
//@desc Get profile by user ID
//@access Public

//req.params object defaults to {}.
router.get("/user/:user_id", async (req, res) => {
	try {
		const profile = await Profile.findOne({
			user: req.params.user_id,
		}).populate("user", ["name", "avatar"]);

		if (!profile) return res.status(400).json({ msg: "Profile not found" });
		res.json(profile);
	} catch (error) {
		console.error(error.message);
		if (error.kind === "ObjectId") {
			return res.status(400).json({ msg: "Profile not found" });
		}
		res.status(500).send("Profile not found");
	}
});

//@route DELETE api/profile
//@desc Delete profile and associated user & posts
//@access Private

//private so access to token
router.delete("/", auth, async (req, res) => {
	try {
		//@todo - remove user's posts

		//Remove profile
		await Profile.findOneAndDelete({ user: req.user.id });
		//Remove user
		await User.findOneAndDelete({ _id: req.user.id });

		res.json({ msg: "User removed" });
	} catch (err) {
		console.error(err.message);
		res.status(500).send("Server Error");
	}
});

//@route PUT api/profile/experience
//@desc Add experience to profile
//@access Private

//date format for json input in request has to be mm-dd-yyyy
//profile: embedded array for experience with its own id
//Why mongoDB rocks
//structure in 1 collection versus separate experience tables,
//instead of sql and must link relationships etc

router.put(
	"/experience",
	[
		auth,
		[
			check("title", "Title is required").not().isEmpty(),
			check("company", "Company is required").not().isEmpty(),
			check("from", "From Date is required").not().isEmpty(),
		],
	],
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const {
			title,
			company,
			location,
			from,
			to,
			current,
			description,
		} = req.body;

		const newExp = { title, company, location, from, to, current, description };

		try {
			const profile = await Profile.findOne({ user: req.user.id });
			profile.experience.unshift(newExp);
			await profile.save();
			res.json(profile); //helps with frontend later
		} catch (err) {
			console.error(err.message);
			res.status(500).send("Server Error");
		}
	}
);

//@route DELETE api/profile/experience/:exp_id
//@desc Delete experience from profile
//@access Private

//map through profile and pass through item, return id, chain on to it with index of,

router.delete("/experience/:exp_id", auth, async (req, res) => {
	try {
		const profile = await Profile.findOne({ user: req.user.id });
		//Get remove index
		const removeIndex = profile.experience
			.map((item) => item.id)
			.indexOf(req.params.exp_id);
		if (removeIndex !== -1) {
			profile.experience.splice(removeIndex, 1);
			await profile.save();
			res.json(profile);
		} else {
			return res.status(404).json({ msg: "Provided Wrong Experience ID" });
		}
	} catch (err) {
		console.error(err.message);
		res.status(500).send("Server Error");
	}
});

//own method
//@route PATCH api/profile/experience/:exp_id
//@desc Edit experience from profile (edit existing fields and adds new fields)
//@access Private

router.patch("/experience/:exp_id", auth, async (req, res) => {
	const { title, company, location, from, to, current, description } = req.body;

	const experienceFields = {};
	if (title) experienceFields["title"] = title;
	if (company) experienceFields["company"] = company;
	if (location) experienceFields["location"] = location;
	if (from) experienceFields["from"] = from;
	if (to) experienceFields["to"] = to;
	if (current) experienceFields["current"] = current;
	if (description) experienceFields["description"] = description;

	try {
		const profile = await Profile.findOne({ user: req.user.id });
		const editIndex = profile.experience
			.map((item) => item.id)
			.indexOf(req.params.exp_id);

		if (editIndex !== -1) {
			//map what has not been changed, prevent experience id from changing with every save
			const listExperience = [
				"_id",
				"title",
				"company",
				"location",
				"from",
				"to",
				"current",
				"description",
			];
			const profileExperience = profile.experience[editIndex];
			const fieldsToCopy = listExperience.filter(
				(i) => !Object.keys(experienceFields).includes(i)
			);

			fieldsToCopy.forEach((element) => {
				if (element === "_id") {
					experienceFields[element] = profileExperience.id;
				} else {
					experienceFields[element] = profileExperience.get(element);
				}
			});

			updatedProfile = await Profile.findOneAndUpdate(
				{ user: req.user.id, "experience._id": req.params.exp_id },
				{ $set: { "experience.$": experienceFields } },
				{ new: true, upsert: true }
			);

			return res.json(updatedProfile);
		} else {
			return res.status(404).json({ msg: "Provided Wrong Experience ID" });
		}
	} catch (error) {
		console.error(error.message);
		res.status(500).send("Server Error");
	}
});

//@route PUT api/profile/education
//@desc Add education to profile
//@access Private

router.put(
	"/education",
	[
		auth,
		[
			check("school", "School is required").not().isEmpty(),
			check("degree", "Degree is required").not().isEmpty(),
			check("fieldofstudy", "Field of Study is required").not().isEmpty(),
			check("from", "From Date is required").not().isEmpty(),
		],
	],
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const {
			school,
			degree,
			fieldofstudy,
			from,
			to,
			current,
			description,
		} = req.body;

		const newEdu = {
			school,
			degree,
			fieldofstudy,
			from,
			to,
			current,
			description,
		};

		try {
			const profile = await Profile.findOne({ user: req.user.id });
			profile.education.unshift(newEdu); //adds to the front
			await profile.save();
			res.json(profile); //helps with frontend later
		} catch (err) {
			console.error(err.message);
			res.status(500).send("Server Error");
		}
	}
);

//@route DELETE api/profile/education/:edu_id
//@desc Delete education from profile
//@access Private

router.delete("/education/:edu_id", auth, async (req, res) => {
	try {
		const profile = await Profile.findOne({ user: req.user.id });

		//Get remove index
		const removeIndex = profile.education
			.map((item) => item.id)
			.indexOf(req.params.edu_id);

		//force deletion of posts only when there is a strict match in id provided
		//prevents issue of last object in array being deleted
		if (removeIndex !== -1) {
			profile.education.splice(removeIndex, 1);

			await profile.save();
			res.json(profile);
		} else {
			return res.status(404).json({ msg: "Provided Wrong Education ID" });
		}
	} catch (err) {
		console.error(err.message);
		res.status(500).send("Server Error");
	}
});

//own method
//@route PATCH api/profile/education/:edu_id
//@desc Edit education from profile (edit existing fields and adds new fields)
//@access Private

router.patch("/education/:edu_id", auth, async (req, res) => {
	const {
		school,
		degree,
		fieldofstudy,
		from,
		to,
		current,
		description,
	} = req.body;

	const educationFields = {};
	if (school) educationFields["school"] = school;
	if (degree) educationFields["degree"] = degree;
	if (fieldofstudy) educationFields["fieldofstudy"] = fieldofstudy;
	if (from) educationFields["from"] = from;
	if (to) educationFields["to"] = to;
	if (current) educationFields["current"] = current;
	if (description) educationFields["description"] = description;

	try {
		const profile = await Profile.findOne({ user: req.user.id });
		const editIndex = profile.education
			.map((item) => item.id)
			.indexOf(req.params.edu_id);

		if (editIndex !== -1) {
			//map what has not been changed, prevent experience id from changing with every save
			const listEducation = [
				"_id",
				"school",
				"degree",
				"fieldofstudy",
				"from",
				"to",
				"current",
				"description",
			];
			const profileEducation = profile.education[editIndex];

			const fieldsToCopy = listEducation.filter(
				(i) => !Object.keys(educationFields).includes(i)
			);

			fieldsToCopy.forEach((element) => {
				if (element === "_id") {
					educationFields[element] = profileEducation.id;
				} else {
					educationFields[element] = profileEducation.get(element);
				}
			});

			updatedProfile = await Profile.findOneAndUpdate(
				{ user: req.user.id, "education._id": req.params.edu_id },
				{ $set: { "education.$": educationFields } },
				{ new: true, upsert: true }
			);

			return res.json(updatedProfile);
		} else {
			return res.status(404).json({ msg: "Provided Wrong Education ID" });
		}
	} catch (error) {
		console.error(error.message);
		res.status(500).send("Server Error");
	}
});

//@route GET api/profile/github/:username
//@desc Get user repositories from Github
//@access Public

//sort by date created in ascending order
//use personal access token created from github developer part of settings with no special permissions
router.get("/github/:username", async (req, res) => {
	try {
		const uri = encodeURI(
			`htttps://api.github.com/users/${req.params.username}/repos?per_page=5&sort=created:asc`
		);

		const headers = {
			"user-agent": "node.js",
			Authorization: `token ${config.get("githubAccessToken")}`,
		};

		const gitHubResponse = await axios.get(uri, { headers });
		return res.json(gitHubResponse.data);
	} catch (error) {
		console.error(error.message);
		res.status(404).json({ msg: "No Github profile found" });
	}
});

module.exports = router;
