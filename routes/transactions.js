// LIQUIFY TEST BUILD WITH PLAID

// --------------------------------------------
// --- REQUIRE() STATEMENTS ---
// --------------------------------------------

// : Basic Node.js modules available by default
const path = require('path');

// : Use 'parseurl' for removing certain pages from our "visited" list in our session data
//const parseurl = require('parseurl');

// : Require Express and its router, alongside other express-related modules
const express = require('express');
const router = express.Router();
const Transaction = require(path.join(__dirname, '../src/models/Transaction.js'));
const { body, check, validationResult, sanitizeBody } = require('express-validator');
// : Require 'zxcvbn' password strength algorithm by Dropbox for processing password strength upon account creation
//const zxcvbn = require('zxcvbn');	// Password strength algorithm by Dropbox

// : Requiring other methods and functions from other local files
const { 
	prettyPrintResponse, 	// Pretty prints error responses
	generateRandomNumber,	// Offered by 'momomo' on stack overflow
	createHash,				// Creating a hash from a password or any given string
	createRandomHash, 		// Generates new random hashes that are randomized and are hashed by SHA256
	verifyHash,				// Verifying if a provided string and a hash are valid
	createConnection, 		// creates a connection within our MySQL pool
	rollbackTransactions,	// Rolling Back Transactions
	beginTransactions, 		// Beginning Transactions
	performQuery,			// Performing a Query in a Transaction
	commitTransaction, 		// Committing Transactions
	sendEmail,				// Sending Emails to a specific user
} = require(path.join(__dirname,'../src/common.js'));


// --------------------------------------------
// --- TRANSACTIONS LIST REQUEST HANDLING ---
// --------------------------------------------

router.post('/', Transaction.validate('session'), Transaction.get_all_transactions);

router.post('/items', Transaction.validate('session'), (request,response,next)=>{
	return response.status(200).json(null);
});

/*
// --------------------------------------------
// --- LOGIN REQUEST HANDLING ---
// --------------------------------------------

router.route('/login')
	// : When users access the login url via GET (aka they're trying to log in via form)
	.get(function(request,response,next){
		// : Setup error value to send to Login form for printing
		var already = false, error = '';

		if (request.session.user.session_id) {
			already = true;
		}

		// : If we already got an error message from a previous attempt or whatnot, we grab it
		if (request.session.user.login_error != null) {
			error = request.session.user.login_error || error;
			delete request.session.user.login_error;
		}

		// : Return a rendered EJS response
		return response.render('user/login', { 
			already: already,
			error: error 
		});
	})
	// : When users submit a login form via POST
	.post(
		User.validate('login'), 
		User.login
	);


// --------------------------------------------
// --- VERIFICATION REQUEST HANDLING ---
// --------------------------------------------

router.route('/verify')
	// : When users access the verification page url via GET (aka they're not verified and need to be)
	.get(function(request,response,next){
		// : Setup error value to send to Login form for printing
		var error = '';
		var name = request.session.user.legal_name
		if (!request.session.user.verify_error) {
			error = request.session.user.verify_error || error;
		}

		return response.render('user/verify', {
			name: name,
			error: error
		});
	})
	.post(User.validate('verification'), User.verify);

router.post('/resendVerification',User.resendVerification);

router.get('/verified',function(request,response,next){
	var name = request.session.user.legal_name;
	return response.render('user/verified', {
		name: name
	});
});

// --------------------------------------------
// --- LOGOUT REQUEST HANDLING ---
// --------------------------------------------

router.get('/logout', (request, response, next) => {
	var session_id = request.session.user.session_id;
	var error = null;

	User.logout(session_id, (err,res,body)=>{
		if (err) {
			return response.status(500).json(err);
		}
		var resBody = JSON.parse(res.body);
		if (res.statusCode !== 200 || !resBody.success) {
			error = resBody.msg || 'Could not log out of account.'
			return response.render('user/logout',{
				error: error
			});
		} else {
			request.session.destroy((err)=>{
				return response.redirect('/user/login');
			});
		}
	})
});


// --------------------------------------------
// --- LINK ACCOUNT REQUEST HANDLING ---
// --------------------------------------------
router.route('/connect')
	.get((request, response, next)=>{
		var back = request.session.user.visited[request.session.user.visited.length-2] || '/';
		var error = '';
		var plaid_credentials = request.plaid_credentials
		if (request.session.user.connect_error != null) {
			error = request.session.user.connect_error || error;
			delete request.session.user.connect_error;
		}
		return response.render('user/connect',{
			back: back,
			error: error,
			PLAID_PUBLIC_KEY: plaid_credentials.PLAID_PUBLIC_KEY,
			ENVIRONMENT: plaid_credentials.ENVIRONMENT,
			PLAID_PRODUCTS: plaid_credentials.PLAID_PRODUCTS,
			PLAID_COUNTRY_CODES: plaid_credentials.PLAID_COUNTRY_CODES
		});
	});

router.post('/get_access_token', User.validate('get_access_token'), User.get_access_token);
*/

module.exports = router;