const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const { check, validationResult } = require("express-validator");
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const Post = require("../../models/Post");
const Profile = require("../../models/Profile");

//name and avatar associated will get as a request using the token we have
//added own spam checking functionality

//@route POST api/posts
//@desc Create a post
//@access Private
router.post(
	"/",
	[auth, [check("text", "Text is required").not().isEmpty()]],
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		try {
			const user = await User.findById(req.user.id).select("-password");

			//filter posts to find if post text already exists for user to prevent spam
			//convert to ObjectId as user types is Schema.Types.ObjectId
			profilePosts = await Post.find({
				user: mongoose.Types.ObjectId(req.user.id),
			});

			if (
				profilePosts.filter((post) => post.text === req.body.text).length > 0
			) {
				return res.status(400).json({ msg: "Duplicate post content" });
			} else {
				const newPost = new Post({
					text: req.body.text,
					name: user.name,
					avatar: user.avatar,
					user: req.user.id,
				});

				const post = await newPost.save();
				res.json(post);
			}
		} catch (error) {
			console.error(error.message);
			res.status(500).send("Server Error");
		}
	}
);

//@route GET api/posts
//@desc Get all posts
//@access Private

//most recent posts first so -1, default is 1
router.get("/", auth, async (req, res) => {
	try {
		const posts = await Post.find().sort({ date: -1 });
		res.json(posts);
	} catch (error) {
		console.error(error.message);
		res.status(500).send("Server Error");
	}
});

//@route GET api/posts/:post_id
//@desc Get a single post by ID
//@access Private

router.get("/:post_id", auth, async (req, res) => {
	try {
		const post = await Post.findById(req.params.post_id);
		if (!post) {
			return res.status(404).json({ msg: "Post not found" });
		}
		res.json(post);
	} catch (error) {
		if (error.kind === "ObjectId") {
			return res.status(404).json({ msg: "Post not found" });
		}
		console.error(error.message);
		res.status(500).send("Server Error");
	}
});

//@route DELETE api/posts/:post_id
//@desc Delete a post by ID
//@access Private

//only user who can own the post can delete the post
//post.user is not a string
router.delete("/:post_id", auth, async (req, res) => {
	try {
		const post = await Post.findById(req.params.post_id);

		if (!post) {
			return res.status(404).json({ msg: "Post not found" });
		}

		//Check user
		if (post.user.toString() !== req.user.id) {
			return res.status(401).json({ msg: "User is not authorized" });
		}

		await post.remove();

		res.json({ msg: "Post removed" });
	} catch (error) {
		if (error.kind === "ObjectId") {
			return res.status(404).json({ msg: "Post not found" });
		}
		console.error(error.message);
		res.status(500).send("Server Error");
	}
});

//@route PATCH api/posts/:post_id
//@des Edit a post by ID
//@access Private

//Own method
//only user who can own the post can edit
//but only if the text is not present in any of his / her existing posts

router.patch(
	"/:post_id",
	[auth, [check("text", "Text is required").not().isEmpty()]],
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}
		try {
			let post = await Post.findById(req.params.post_id);

			if (!post) {
				return res.status(404).json({ msg: "Post not found" });
			}

			//Check user
			if (post.user.toString() !== req.user.id) {
				return res.status(401).json({ msg: "User is not authorized" });
			}

			//filter posts to find if post text already exists for current user to prevent spam
			profilePosts = await Post.find({
				user: mongoose.Types.ObjectId(req.user.id),
			});

			if (
				profilePosts.filter((post) => post.text === req.body.text).length > 0
			) {
				return res.status(400).json({ msg: "Duplicate post content" });
			} else {
				//Update post with new text
				post = await Post.findOneAndUpdate(
					{ _id: req.params.post_id },
					{ $set: { text: req.body.text } },
					{ new: true }
				);

				return res.json(post);
			}
		} catch (error) {
			if (error.kind === "ObjectId") {
				return res.status(404).json({ msg: "Post not found" });
			}
			console.error(error.message);
			res.status(500).send("Server Error");
		}
	}
);

//@route PUT api/posts/like/:post_id
//@desc Like a post
//@access Private

//each like has its own object id
router.put("/like/:post_id", auth, async (req, res) => {
	try {
		const post = await Post.findById(req.params.post_id);
		//Check if post has already been liked by current user
		//filter -> if =1 already liked

		if (
			post.likes.filter((like) => like.user.toString() === req.user.id).length >
			0
		) {
			return res.status(400).json({ msg: "Post is already liked" });
		}

		post.likes.unshift({ user: req.user.id });
		await post.save();
		res.json(post.likes);
	} catch (error) {
		if (error.kind === "ObjectId") {
			return res.status(404).json({ msg: "Post not found" });
		}
		console.error(error);
		res.status(500).send("Server Error");
	}
});

//@route PUT api/posts/unlike/:post_id
//@desc Like a post
//@access Private
router.put("/unlike/:post_id", auth, async (req, res) => {
	try {
		const post = await Post.findById(req.params.post_id);
		//Check if post has already been liked by current user
		//filter -> if =1 already liked

		if (
			post.likes.filter((like) => like.user.toString() === req.user.id)
				.length === 0
		) {
			return res.status(400).json({ msg: "Post has not yet been liked" });
		}

		//Get remove index
		const removeIndex = post.likes
			.map((like) => like.user.toString())
			.indexOf(req.user.id);
		post.likes.splice(removeIndex, 1);

		await post.save();

		res.json(post.likes);
	} catch (error) {
		if (error.kind === "ObjectId") {
			return res.status(404).json({ msg: "Post not found" });
		}
		console.error(error);
		res.status(500).send("Server Error");
	}
});

//@route POST api/posts/comment/:post_id
//@desc Comment on a post
//@access Private
router.post(
	"/comment/:post_id",
	[auth, [check("text", "Text is required").not().isEmpty()]],
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		try {
			const user = await User.findById(req.user.id).select("-password");
			const post = await Post.findById(req.params.post_id);

			//own method to prevent spam from duplicate sends from the same user
			const newComment = {
				text: req.body.text,
				name: user.name,
				avatar: user.avatar,
				user: req.user.id,
			};

			post.comments.unshift(newComment);
			await post.save();
			res.json(post.comments());
		} catch (error) {
			if (error.kind === "ObjectId") {
				return res.status(404).json({ msg: "Post not found" });
			}
			console.error(error.message);
			res.status(500).send("Server Error");
		}
	}
);

//@route DELETE api/posts/comment/:post_id/:comment_id
//@desc Delete a comment on a post
//@access Private

//only user who can commented on post can remove it
router.delete("/comment/:post_id/:comment_id", auth, async (req, res) => {
	try {
		const post = await Post.findById(req.params.post_id);

		//Pull out comment
		const comment = post.comments.find(
			(comment) => comment.id === req.params.comment_id
		);

		//Check if comment exists
		if (!comment) {
			return res.status(404).json({ msg: "Comment does not exist" });
		}

		//Check user
		if (comment.user.toString() !== req.user.id) {
			return res.status(401).json({ msg: "User is not authorized" });
		}

		//Get remove index
		const removeIndex = post.comments
			.map((comment) => comment.user.toString())
			.indexOf(req.user.id);

		post.comments.splice(removeIndex, 1);

		await post.save();

		res.json(post.comments);
	} catch (error) {
		if (error.kind === "ObjectId") {
			return res.status(404).json({ msg: "Post not found" });
		}
		console.error(error.message);
		res.status(500).send("Server Error");
	}
});

module.exports = router;
