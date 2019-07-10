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
const { body, validationResult, sanitizeBody } = require('express-validator');
const { performQuery, beginTransactions, verifyHash, createHash, createRandomHash, generateRandomNumber, sendEmail, isArray, encryptData, decryptData, } = require('../common');
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
		case 'update': {
			return [
				body('session_id','Session ID is Invalid')
					.trim()
					.exists()
					.isLength({min:1}),
				body('category','Invalid Category')
					.trim()
					.exists()
					.escape()
					.isIn(['budgets','finAid']),
				body('part','Invalid Part')
					.trim()
					.exists()
					.escape()
					.custom((value,{req})=>{
						var valid = true;
						switch(req.body.category) {
							case 'budgets': {
								if (['intro','creating','adjusting','controlling','specialized'].indexOf(value) == -1) valid = false;
								break;
							}
							case 'finAid': {
								if (['intro','applying','types','loans','repaying'].indexOf(value) == -1) valid = false;
								break;
							}
							default: {
								valid = false;
							}
						}
						return valid;
					}),
				body('score','Invalid Score')
					.trim()
					.exists()
					.escape()
					.isInt()
					.custom((value,{req})=>{
						var parsed = parseInt(value);
						if (parsed < 0 || parsed > 2) return false;
						return true;
					})
			]
		}
		case 'get': {
			return [
				body('session_id','Session ID is Invalid.')
					.trim()
					.exists()
					.isLength({min:1}),
				body('budget_id','Budget ID is Invalid.')
					.trim()
					.exists()
					.isLength({min:1})
			]
		}
		case 'create': {
			return [
				body('session_id','')
					.trim()
					.exists()
					.isLength({min:1}),
				body('budget_id','')
					.custom((value,{req})=>{
						if (typeof value === 'undefined' || value == '') return true;
						return value.trim().length > 0;
					}),
				body('name','Invalid Budget Name')
					.trim()
					.exists()
					.isLength({min:1,max:50}),
				body('description','Invalid Budget Description')
					.trim()
					.custom((value,{req})=>{
						if (typeof value === 'undefined' || value.length == 0) {
							return true;
						} else {
							return (typeof value === 'string' && value.length <= 150);
						}
					}),
				body('allocations','Invalid Allocation(s)')
					.custom((value,{req})=>{
						var allocations = req.body['allocations'];
						if (allocations.length == 0) throw new Error('No allocations defined.');
						for (let i = 0; i < allocations.length; i++) {
							var name = allocations[i].name;
							var total = allocations[i].total;
							var amount = allocations[i].amount;
							if (typeof name === 'undefined' || name.length == 0 || !name.match(/^[\w\-\s]+$/)) throw new Error(`Invalid allocation name in Allocation #${(i+1)}`);
							if (typeof total === 'undefined' || total.length == 0 || isNaN(total) || parseFloat(total) < 0) throw new Error(`Invalid allocation total in Allocation #${(i+1)}`);
							if (typeof amount === 'undefined' || amount.length == 0 || isNaN(amount) || parseFloat(amount) < 0) throw new Error(`Invalid allocation amount in Allocation #${(i+1)}`);
						}
						return true;
					}),
				body('date_created','Invalid Date of Creation')
					.custom((value,{req})=>{
						if (typeof value === 'undefined' || value.length == 0) return true;
						return (value.trim()).length > 0;
					}),
				sanitizeBody('name','description')
			]
		}
	}
}

// --------------------------------------------
// --- GET (and decrypt) ALL BUDGETS ---
// --------------------------------------------
exports.all = (request, response, next) => {
	// : Get session id from request
	var {session_id, budgets} = request.body;
	var {errors} = validationResult(request);
	// : If we got any errors, we send the user an error
	if (errors.length > 0) {
		return sendResponse(response,404,false,errors[0].msg);
	}

	if (budgets.length == 0) {
		return sendResponse(response, 200, false, 'No budgets are connected to your account.');
	}

	// : by this point, budgets should be an array that's a list of objects with just "budget_id" as their keys
	var budgets_filtered = budgets.reduce((filtered,b)=>{
		filtered.push(b.budget_id);
		return filtered;
	},[]);


	//return sendResponse(response, 200, true, JSON.stringify({budgets:'haha'}));

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
		var query = 'SELECT t1.budget_id AS budget_id, t1.budget_data AS budget_data FROM `Budgets` AS t1 LEFT JOIN `User_Sessions` AS t2 ON t1.user_id = t2.user_id WHERE t2.session_id = ?';
		var params = [session_id];
		var budgets_received = null;
		// : Attempt the query to get all items associated with user
		try {
			budgets_received = await performQuery(connection, query, params);
		} catch(e) {
			// : If some error in query execution, we release the connection and reject w/ Error
			connection.release();
			let err = e.sqlMessage || e;
			return sendResponse(response, 503, false, err);
		}
		// : If no budgets found, we send a success status but a success of false
		if (budgets_received.length == 0) {
			connection.release();
			return sendResponse(response, 200, false, 'No bank accounts were linked to your Liquify account');
    	}
    	// ; need to decrypt budget data
    	var budgets_decrypted = budgets_received.reduce((filtered,b)=>{
    		//if (budgets_filtered.indexOf(b.budget_id) >= 0) {
    			filtered.push(JSON.parse(decryptData(b.budget_data)));
    		//}
    		return filtered;
    	},[]);

    	// : We release the connection officially
    	connection.release();
    	// : We send the data back to our app
    	return sendResponse(response, 200, true, {budgets:budgets_decrypted});
	});
}

// --------------------------------------------
// --- GET (and decrypt) LEARN DATA ---
// --------------------------------------------
exports.get = (request, response, next) => {
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
		var query = 'SELECT t1.learn_data AS learn_data FROM `Learn` AS t1 LEFT JOIN `User_Sessions` AS t2 ON t1.user_id = t2.user_id WHERE t2.session_id = ?';
		var params = [session_id];
		var learn_get = null
		// : Attempt the query to get all items associated with user
		try {
			learn_get = await performQuery(connection, query, params);
		} catch(e) {
			// : If some error in query execution, we release the connection and reject w/ Error
			connection.release();
			let err = e.sqlMessage || e;
			return sendResponse(response, 503, false, err);
		}
		// : If no learn data was found, we create a sample of that data using a predefined template, 
		// : 	save it into the DB, then return that sampled template 
		if (learn_get.length == 0) {
			var template = {
				budgets:{
					intro:0,
					creating:0,
					controlling:0,
					adjusting:0,
					specialized:0
				},
				finAid:{
					intro:0,
					applying:0,
					types:0,
					loans:0,
					repaying:0
				},
			}
			var template_encrypted = encryptData(JSON.stringify(template));
			query = 'INSERT INTO `Learn` (`user_id`, `learn_data`) VALUES ((SELECT `user_id` FROM `User_Sessions` WHERE `session_id` = ? LIMIT 1), ?);';
			params = [session_id, template_encrypted];
			try {
				await performQuery(connection,query,params);
			} catch(e) {
				// : Instead of ending here, we just print out the error and move on...
				let err = e.sqlMessage || e;
				console.log(err);
			}
			connection.release();
			console.log(template);
			return sendResponse(response, 200, true, template);
    	}

    	var learn_raw = learn_get[0].learn_data;

    	// ; need to decrypt budget data
    	var learn_decrypted = JSON.parse(decryptData(learn_raw));
    	//console.log(learn_decrypted);

    	// : We release the connection officially
    	connection.release();
    	// : We send the data back to our app
    	return sendResponse(response, 200, true, learn_decrypted);
	});
}

// --------------------------------------------
// --- UPDATE LEARN DATA ---
// --------------------------------------------
exports.update = async(request,response,next) => {
	// : When users are trying to create a Budget
	// : The necessary requirements for creating a budget are the following:
	// : 	- session_id = needed for linking budget with user
	// : 	- name = name of budget, max length = 100 (50 in client, but that's just for security)
	// : 	- description = description of budget, max length = 200 (150 in client, but that's just for security)
	// : 	- allocations = array of allocation objects {name:__,amount:__}

	// : Get original values from request body, as well as error results from validator
	var {session_id, category, part, score} = request.body,
		{errors} = validationResult(request);

	// : If we got any errors, we send a non-200 status response
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
		var query = 'SELECT t1.learn_data AS learn_data FROM `Learn` AS t1 LEFT JOIN `User_Sessions` AS t2 ON t1.user_id = t2.user_id WHERE t2.session_id = ?';
		var params = [session_id];
		var learn_get = null;
		// : Attempt to insert data into DB table "Budgets"
		try {
			learn_get = await performQuery(connection, query, params);
		} catch(e) {
			// : If some error in query execution, we release the connection and reject w/ Error
			connection.release();
			let err = e.sqlMessage || e;
			return sendResponse(response, 503, false, err);
		}

		// : If no learn data was found, we create a sample of that data using a predefined template, 
		// : 	save it into the DB, then return that sampled template 
		if (learn_get.length == 0) {
			var template = {
				budgets:{
					intro:0,
					creating:0,
					controlling:0,
					adjusting:0,
					specialized:0
				},
				finAid:{
					intro:0,
					applying:0,
					types:0,
					loans:0,
					repaying:0
				},
			}
			if (template[category][part]) template[category][part] = parseInt(score);
			var template_encrypted = encryptData(JSON.stringify(template));
			query = 'INSERT INTO `Learn` (`user_id`, `learn_data`) VALUES ((SELECT `user_id` FROM `User_Sessions` WHERE `session_id` = ? LIMIT 1), ?);';
			params = [session_id, template_encrypted];
			try {
				await performQuery(connection,query,params);
			} catch(e) {
				// : Instead of ending here, we just print out the error and move on...
				let err = e.sqlMessage || e;
				console.log(err);
			}
			connection.release();
			return sendResponse(response, 200, true, template);
    	}

    	var learn_raw = learn_get[0].learn_data;
    	// ; need to decrypt budget data
    	var learn_decrypted = JSON.parse(decryptData(learn_raw));
    	// : Update current decrypted version with new score
    	var updated_learn = Object.assign(learn_decrypted);
    	console.log(updated_learn);
    	console.log(category);
    	console.log(part);
    	console.log(parseInt(score));
    	if (updated_learn[category][part] != null) {
    		updated_learn[category][part] = (updated_learn[category][part] < parseInt(score)) ? parseInt(score) : updated_learn[category][part];
    	}
    	console.log(updated_learn);
    	var learn_encrypted = encryptData(JSON.stringify(updated_learn));

    	query = 'UPDATE `Learn` SET `learn_data` = ? WHERE `user_id` = (SELECT `user_id` FROM `User_Sessions` WHERE `session_id` = ? LIMIT 1);';
    	params = [learn_encrypted,session_id];
    	try {
			await performQuery(connection,query,params);
		} catch(e) {
			// : Instead of ending here, we just print out the error and move on...
			let err = e.sqlMessage || e;
			console.log(err);
			// : We release the connection officially
    		connection.release();
    		return sendResponse(response, 500, false, err);
		}

    	// : We release the connection officially
    	connection.release();
    	// : We send the data back to our app
    	//console.log(learn_decrypted);
    	return sendResponse(response, 200, true, updated_learn);
	});
}
