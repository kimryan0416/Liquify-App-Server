// --------------------------------------------
// --- MODEL: USER ---
// --------------------------------------------

// : Unique functions pertaining to only the user alone
// : This includes:
// : 	- Validation checking from form inputs
// : 	- user-oriented functions and request handling

// --------------------------------------------
// --- REQUIRE() STATEMENTS ---
// --------------------------------------------
const { body, check, validationResult, sanitizeBody } = require('express-validator');
const { performQuery, beginTransactions, verifyHash, createHash, createRandomHash, generateRandomNumber, sendEmail } = require('../common');
const sendResponse = (response, status, success, msg=null) => {
  return response.status(status).json({success:success,msg:msg});
}

// --------------------------------------------
// --- VALIDATION ---
// --------------------------------------------
exports.validate = (method) => {
	switch (method) {
		case 'session': {
			return [ 
				body('session_id','')
					.trim()
					.exists()
					.isLength({min:1})
			]
		}
	}
}

// --------------------------------------------
// --- GET ALL TRANSACTIONS ---
// --------------------------------------------
exports.get_all_transactions = (request, response, next) => {
	// : Get session id from request
	var {session_id} = request.body;
	var {errors} = validationResult(request);
	// : If we got any errors, we send the user an error
	if (errors.length > 0) {
		return sendResponse(response,404,false,errors[0].msg);
	}
	// : Prepare MySQL pool
	var p = request.pool;
	// : Initiate connection with MySQL pool
	p.getConnection(async(error,connection)=>{
		// : If error creating connection, we send the user an error
		if (error) {
			let err = error.msg || error;
			return sendResponse(response, 503, false, err);
		}
		// : Preparing query, parameters, and results array (items)
		var query = 'SELECT t1.access_token AS access_token FROM `Items` LEFT JOIN `User_Sessions` AS t2 ON t1.user_id = t2.user_id WHERE t2.session_id = ?';
		var params = [session_id];
		var items = null;
		// : Attempt the query to get all items associated with user
		try {
			items = await performQuery(connection, query, params);
		} catch(e) {
			// : If some error in query execution, we release the connection and reject w/ Error
			connection.release();
			let err = e.msg || e;
			return sendResponse(response, 503, false, err);
		}
		// : If no items found, we send a success status but a success of false
		if (items.length == 0) {
			connection.release();
			return sendResponse(response, 200, false, 'No bank accounts were linked to your Liquify account');
    	}
    	// : We release the connection officially
    	connection.release();
    	// : We send the data back to our app
    	return sendResponse(response, 200, true, JSON.stringify(items));
	});
}

/*
exports.login = (request,response,next) => {
	// : When users are trying to submit a login request via POST

	// : Get original values from request body, as well as error results from validator
	var {email, password} = request.body,
		fingerprint = request.fingerprint.hash,
		{errors} = validationResult(request);

	// : Set our values within our session login variable
	request.session.user.login_error = null;

	// : If we got any errors, we send the user right back to the login form with the appropriate values
	if (errors.length > 0) {
		//request.session.user.login_error = errors[0].msg;
		request.session.user.login_error = "The provided email/password combination is invalid.";
		return response.redirect('/user/login');
	}

	// : Perform the HTTPS call to our Liquify Server
	// : Helpful links to refer to:
	// : 	https://stackoverflow.com/questions/10888610/ignore-invalid-self-signed-ssl-certificate-in-node-js-with-https-request
	// : 	https://stackoverflow.com/questions/19665863/how-do-i-use-a-self-signed-certificate-for-a-https-node-js-server/24749608
	// : 	https://stackoverflow.com/questions/6158933/how-is-an-http-post-request-made-in-node-js/6158966#6158966
	var req_options = {
		url: 'https://localhost:8002/user/login',
		method: 'POST',
		body: JSON.stringify({email:email,password:password,fingerprint:fingerprint}),
		rejectUnauthorized: false,
		requestCert: true,
		agent: false,
		headers: {
			'Content-Type':'application/json'
		}
	};
	req(req_options, (err,res,body)=>{
		if (err) {
			return response.json(err);
		}
		var resBody = JSON.parse(res.body);
		if (res.statusCode  !== 200 || !resBody.success) {
			request.session.user.login_error = resBody.msg || 'Error connecting to Database.';
			response.redirect('/user/login');
		} else {
			var r = JSON.parse(resBody.msg);
			request.session.user.session_id = 	r.session_id;
			request.session.user.id = 			r._id;
			request.session.user.legal_name = 	r._legal_name;
			request.session.user.email = 		r._email;
			request.session.user.valid = 		r._valid;
				// : If the user is NOT valid yet, then we have to ask them to verify their account via the code that
				//		was sent to their email when they created their account.
				if (!r._valid) {
					return response.redirect('/user/verify');
				}

				// : Otherwise, we can safely return the user back to whichever page they were at last time
				var returnTo = (request.session.user.visited && request.session.user.visited[request.session.user.visited.length-1] != null) ? request.session.user.visited[request.session.user.visited.length-1] : '/';
				return response.redirect(returnTo);
		}
	});
}

exports.resendVerification = (request,response,next)=>{
	var user_session_id = request.session.user.session_id;

	var req_options = {
		url: 'https://localhost:8002/user/resend_verification',
		method: 'POST',
		body: JSON.stringify({session_id:user_session_id}),
		rejectUnauthorized: false,
		requestCert: true,
		agent: false,
		headers: {
			'Content-Type':'application/json'
		}
	};
	req(req_options, (err,res,body)=>{
		if (err) {
			return response.status(500).json(err);
		}
		var resBody = JSON.parse(res.body);
		var success = res.statusCode === 200 && resBody.success == true;
		var msg = resBody.msg;
		return response.status(res.statusCode).json({success:success,msg:msg});
	});
}

exports.verify = (request, response, next) => {
	// : When users are trying to submit a verification request via POST

	// : Get original values from request body, as well as error results from validator
	var {verifyCode} = request.body,
		session_id = request.session.user.session_id,
		{errors} = validationResult(request);

	// : Set our values within our session login variable
	request.session.user.verify_error = null;

	// : If we got any errors, we send the user right back to the login form with the appropriate values
	if (errors.length > 0) {
		//request.session.user.login_error = errors[0].msg;
		request.session.user.verify_error = "The provided Access Code is invalid.";
		return response.redirect('/user/verify');
	}

	var req_options = {
		url: 'https://localhost:8002/user/verify',
		method: 'POST',
		body: JSON.stringify({session_id:session_id,verify_code: verifyCode}),
		rejectUnauthorized: false,
		requestCert: true,
		agent: false,
		headers: {
			'Content-Type':'application/json'
		}
	};
	req(req_options, (err,res,body)=>{
		if (err) {
			return response.status(500).json(err);
		}
		var resBody = JSON.parse(res.body);
		if (res.statusCode !== 200 || !resBody.success) {
			request.session.user.verify_error = resBody.msg;
			return response.redirect('/user/verify');
		} else {
			return response.redirect('/user/verified');
		}
	});
}

exports.logout = (session_id, next) => {
	var req_options = {
		url: 'https://localhost:8002/user/logout',
		method: 'POST',
		body: JSON.stringify({session_id:session_id}),
		rejectUnauthorized: false,
		requestCert: true,
		agent: false,
		headers: {
			'Content-Type':'application/json'
		}
	};
	req(req_options, next);
}

exports.account = (session_id, next) => {
	var req_options = {
		url: 'https://localhost:8002/user/account',
		method: 'POST',
		body: JSON.stringify({session_id:session_id}),
		rejectUnauthorized: false,
		requestCert: true,
		agent: false,
		headers: {
			'Content-Type':'application/json'
		}
	};
	req(req_options, next);
}

exports.get_access_token = (request, response, next) => {
	// : Exchange token flow - exchange a Link public_token for
	// 		an API access_token
	// 		https://plaid.com/docs/#exchange-token-flow
	var {PUBLIC_TOKEN} = request.body;
	var {errors} = validationResult(request);
	// : If we got any errors, we send the user right back to the login form with the appropriate values
	if (errors.length > 0) {
		return response.status(403).json({errors:errors});
	}
	var client = request.plaid_client;
	client.exchangePublicToken(PUBLIC_TOKEN, (error, tokenResponse)=>{
		if (error != null) {
			console.log(error);
			return response.status(500).json({
				access_token: null,
				item_id: null,
				error: error
			});
		}

		var session_id = request.session.user.session_id;
		var ACCESS_TOKEN = tokenResponse.access_token;
	    var ITEM_ID = tokenResponse.item_id;

	    var req_options = {
			url: 'https://localhost:8002/user/save_access_token',
			method: 'POST',
			body: JSON.stringify({session_id:session_id, access_token:ACCESS_TOKEN, item_id: ITEM_ID}),
			rejectUnauthorized: false,
			requestCert: true,
			agent: false,
			headers: {
				'Content-Type':'application/json'
			}
		};
		req(req_options, (err,res,body)=>{
			if (err) {
				return response.status(500).json(err);
			}
			var resBody = JSON.parse(res.body);
			if (res.statusCode !== 200 || !resBody.success) {
				return response.status(403).json(resBody);
			} else {
				return response.status(200).json({});
			}
		});
	})
}
*/