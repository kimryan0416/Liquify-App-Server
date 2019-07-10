// LIQUIFY TEST BUILD WITH PLAID

// --------------------------------------------
// --- REQUIRE() STATEMENTS ---
// --------------------------------------------

// : Basic Node.js modules available by default
const path = require('path');

// : Requiring functions and methods from local files
const {
	createHash,		// Creating a hash from a password or any given string
	verifyHash,		// Verifying if a provided string and a hash are valid
	encryptData,
} = require(path.join(__dirname,'../src/common.js'));

// : Use 'parseurl' for removing certain pages from our "visited" list in our session data
//const parseurl = require('parseurl');

// : Require Express and its router, alongside other express-related modules
const express = require('express');
const router = express.Router();

// : Require 'zxcvbn' password strength algorithm by Dropbox for processing password strength upon account creation
//const zxcvbn = require('zxcvbn');	// Password strength algorithm by Dropbox

// --------------------------------------------
// --- REQUEST HANDLERS ---
// --------------------------------------------

router.get('/hash/:pass', (request,response,next)=>{
	var password = request.params.pass;
	var hash = createHash(password);
	return response.json({
		original: password,
		hash: hash
	});
});
router.post('/encrypt',(request,response,next)=>{
	var data = request.body.data;
	var encrypted = encryptData(data);
	return response.json({original:data,encrypted:encrypted});
});

module.exports = router;