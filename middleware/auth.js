const jwt = require("jsonwebtoken");
const config = require("config");

//export middleware function with request, response object available to it
module.exports = function (req, res, next) {
	const token = req.header("x-auth-token");
	console.log(token);

	//protected route
	if (!token) {
		return res.status(401).json({ msg: "No token, authorization denied" });
	}

	//Verify token
	//then can use request.user in any of our routes, any of protected routes, eg get user profile
	try {
		// const decoded = jwt.verify(token, config.get("jwtSecret"));
		const decoded = jwt.verify(token, config.get("jwt_rsa_publicKey"), {
			algorithm: "RS256",
		});
		req.user = decoded.user;
		next();
	} catch (err) {
		res.status(401).json({ msg: "Token is not valid" });
	}
};
