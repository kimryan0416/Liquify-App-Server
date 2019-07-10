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
const User = require(path.join(__dirname, '../src/models/User.js'));
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

/*
router.get('/:id',(request,response,next)=>{
	return response.redirect('/user/login');
});
*/

// --------------------------------------------
// --- LOGIN REQUEST HANDLING ---
// --------------------------------------------

// : When users are trying to submit a login request via POST
router.post('/login', User.validate('login'), User.login);

router.post('/resend_verification', User.validate('resend_verification'), User.resend_verification);

router.post('/verify', User.validate('verification'), User.verify);

router.post('/logout', User.validate('logout'), User.logout);

router.post('/account', User.validate('account'), User.account);

router.post('/items', User.validate('items'), User.items);

router.post('/save_access_token', User.validate('save_access_token'), User.save_access_token);

/*
// --------------------------------------------
// --- LOGIN REQUEST HANDLING ---
// --------------------------------------------

router.get('/create', (request,response,next)=>{
	response.send('Hello Create');
})



/*



// CREATE ACCOUNT PAGE
router.get('/createAccount', async(req,res)=>{

	var inputs = {name:'', email:'', country:'US', phone:''},
		errors = {};

	if (req.session.user.createAccount != null) {
		inputs = req.session.user.createAccount.inputs;
		errors = req.session.user.createAccount.errors;
		delete req.session.user.createAccount;
	}

	res.render('app/createAccount', {
		title : 'Create Account - Liquify',
		h1 : 'Create Your Account',
		allCountries: req.countryCodes,
		inputs: inputs,
		errors: errors
	});
});

// POST: Processing User Account creation from /app/create
router.post(
	'/createAccount', 
	userController.validate('create'),
	userController.createUser
	/*
	async(req,res)=>{
	// PROCESS:
	// ---
	// Step 1) Basic settins - console-logging views and visited for debugging purposes, 
	//		setting up our pool, etc.
	// Step 2) Processing user input with and without sanitization
	// Step 3) Validation of Inputs
	//		- If any errors were detected at this state, we push a 400 (Bad Request) Status and redirect 
	//			back to "/app/login"
	// Step 4) Get User From DB
	//		- If no rows returned, we push a 404 (Not Found) Status and redirect back to "/app/login"
	// Step 5) Confirm if the row is correct via Password Hash Comparison
	//		- If password confirmation returns false, we push a 400 (Bad Request) Status and redirect 
	//			back to "/app/login"
	// Step 6) Save the necessary information into our session (session ID)
	// Step 7) Redirect back to our most recent app page OR our app's index, depending...
	// ---
	// A note: We're using sessions to temporarily store any error messages and the email input
	// 		This is really one of the few ways we can save error information between page redirects
	// 		The login page is set up so that any sort of req.session.user.login is deleted by the time 
	//		the page is loaded

	// Step 1) Basic settings
	req.session.user.visited.pop();	// Don't want to keep '/processLogin' within pages list
	let p = req.pool,
		countries = req.countryCodes;

	// Step 2) Processing user input without and with sanitization
	let inputName = String(req.body.legalName),
		inputEmail = String(req.body.email),
		inputCountry = String(req.body.countryCode),
		inputPhone = String(req.body.phone),
		inputPassword = String(req.body.password),
		inputPasswordConfirm = String(req.body.passwordConfirm);
	let processedName = req.bodyString('legalName'),
		processedEmail = req.bodyEmail('email'),
		processedCountry = req.bodyString('countryCode'),
		processedPhone = req.bodyString('phone'),
		processedPassword = req.bodyString('password'),
		processedPasswordConfirm = req.bodyString('passwordConfirm');
	if (process.env.PRODUCTION === 'false') {
		console.log(`
			Received Name: ${processedName}\n
			Received Email: ${processedEmail}\n
			Received Country: ${processedCountry}\n
			Received Phone: ${processedPhone}\n
			Received Password: ${processedPassword}\n
			Received PasswordConfirm: ${processedPasswordConfirm}
		`);
	}

	// Step 3) Validation of Inputs - carried over from "app.js" in "/public/javascripts"
	let errors = {},
		errorTrigger = false;

	// NAME VALIDATION
	let reName = /^[0-9a-zA-Z'-., ]{1,16}$/;
	if (typeof processedName !== 'string' || processedName == null) {
		errorTrigger = true;
		errors.name = "The provided name was not a valid name.";
	} else if (processedName.length == 0) {
		errorTrigger = true;
		errors.name = "Please provide a legal name.";
	} else if(!processedName.match(reName)){
		errorTrigger = true;
	    errors.name = "The provided name contains characters that are not alphanumeric.";
	}

	// EMAIL VALIDATION
	var reEmail = /\S+@\S+\.\S+/;
	if (typeof processedEmail !== 'string' || processedEmail == null) {
		errorTrigger = true;
		errors.email = "The provided email was not a valid email.";
	} else if (processedEmail.length == 0) {
		errorTrigger = true;
		errors.email = "Please provide an email.";
	} else if (!reEmail.test(processedEmail)) {
		errorTrigger = true;
		errors.email = "The provided input doesn't match the generic email format.";
	}

	// PHONE AND COUNTRY VALIDATION
	var rePhone = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3,4}[-\s\.]?[0-9]{4,6}$/im;
	if (typeof processedCountry !== 'string' || processedCountry == null) {
		errorTrigger = true;
		errors.phone = "Select a country code for your phone number.";
	} else {
		var fCountry = countries.find(country=>{
			return country.code === processedCountry;
		});
		if(typeof fCountry === 'undefined') {
			errorTrigger = true;
			errors.phone = "The selected country code does not exist within our system.";
		} else if (typeof processedPhone !== 'string' || processedPhone == null) {
			errorTrigger = true;
			error.phone = "Please enter your phone number.";
		} else if (processedPhone.length == 0) {
			errorTrigger = true;
			error.phone = "Please enter your phone number.";
		} else if (!rePhone.test(processedPhone)) {
			errorTrigger = true;
			error.phone = "Your phone number is not a valid number.";
		}
	}

	// PASSWORD VALIDATION
	if (typeof processedPassword === 'undefined' || processedPassword == null) {
		errorTrigger = true;
		errors.password = {
			message: "Password is unable to be processed.",
			score: 0,
			printScore: "No Score Available"
		};
	} else if (processedPassword.length == 0) {
		errorTrigger = true;
		errors.password = {
			message: "Please provide a password.",
			score: 0,
			printScore: "Very Weak"
		};
	} else {
		let passResults = zxcvbn(processedPassword);
		errors.password = {
			message: "",
			score: passResults.score
		};
		errors.password.printScore = (passResults.score == 4) 
				? "Very Strong" 
				: (passResults.score == 3) 
					? "Strong" 
					: (passResults.score == 2) 
						? "Average"
						: (passResults.score == 1)
							? "Weak"
							: (passResults.score == 0) 
								? "Very Weak"
								: "No Score Available";
		if (passResults.feedback.suggestions.length >= 1) {
			errors.password.message = passResults.feedback.suggestions[0]
		}
		if (passResults.score < 3) {
			errorTrigger = true;
		}
	}

	// PASSWORD CONFIRM VALIDATION
	if (processedPassword !== processedPasswordConfirm) {
		errorTrigger = true;
		errors.passwordConfirm = "Passwords do not match.";
	}

	// - If any errors were detected at this state...
	if (errorTrigger == true) {
		req.session.user.createAccount = {
			name: inputName,
			email: inputEmail,
			country: inputCountry,
			phone: inputPhone,
			password: inputPassword,
			passwordConfirm: inputPasswordConfirm,
			nameError: errors.name,
			emailError: errors.email,
			passwordError: errors.password,
			passwordConfirmError: errors.passwordConfirm
		};
		res.status(400).redirect('/app/createAccount');		
		// Error Code 400 = Bad Request: https://httpstatuses.com/400
	} else {
		req.session.user.createAccount = {
			name: inputName,
			email: inputEmail,
			country: inputCountry,
			phone: inputPhone,
			password: inputPassword,
			passwordConfirm: inputPasswordConfirm,
			nameError: errors.name,
			emailError: errors.email,
			passwordError: errors.password,
			passwordConfirmError: errors.passwordConfirm
		}
		res.redirect('/app/createAccount');
	}
}
*/
/*
);
*/
module.exports = router;