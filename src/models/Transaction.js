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
			let err = e.sqlMessage || e;
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

