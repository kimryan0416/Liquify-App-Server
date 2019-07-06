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
    case 'login': {
     return [ 
        body('email', 'The provided email is invalid. Please check that your email is correct.')
          .trim()
          .exists()
          .isLength({min:1})
          .isEmail()
          .matches(/\S+@\S+\.\S+/)
          .normalizeEmail(),
        body('password', 'The provided password is invalid. Please check that your password is correct.')
          .exists()
          .isLength({min:1}),
        body('fingerprint','The provided fingerprint is invalid.')
          .custom((value,{req})=>{
            if (typeof value === 'undefined') {
              return true;
            } else {
              return (typeof value === 'string' && value.length >= 1);
            }
          })
      ]   
    }
    case 'logout': {
      return [
        body('session_id','Session ID is Invalid')
          .trim()
          .exists()
          .isLength({min:1})
      ]
    }
    case 'create_user': {
      return [
        body('legalName', 'The provided legal name is invalid. Please check that your name matches the criteria listed.')
          .trim()
          .exists()
          .isLength({min:1})
          .matches(/^[0-9a-zA-Z'-., ]{1,16}$/),
        body('email', 'The provided email is invalid. Please check that your email is a valid email.')
          .trim()
          .exists()
          .isEmail()
          .matches(/\S+@\S+\.\S+/)
          .normalizeEmail(),
        body('countryCode', 'The selected country code is either invalid or not among our list of country codes. Please check that you have selected one of the provided country code.')
          .trim()
          .exists()
          .isAlpha()
          .isLength({min:1})
          .isUppercase()
          .custom((value,{req})=>{
            var fCountry = country_codes.find(country=>{
              return country.code === value;
            });
            return fCountry !== 'undefined';
          }),
        body('phone', 'The provided phone number is invalid. Please check that your phone number is a valid number')
          .trim()
          .exists()
          .matches(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3,4}[-\s\.]?[0-9]{4,6}$/im),
        body('password', 'The provided password is invalid or too weak. Please retype another password.')
          .exists()
          .isLength({min:1})
          .custom((value,{req})=>{
            let passResults = zxcvbn(value);
            return passResults.score >= 3;
          }),
        body('passwordConfirm', 'The provided confirmation password is either invalid or does not match the provided password. Please retype the confirmation password.')
          .exists()
          .isLength({min:1})
          .custom((value,{req}) => value === req.body.password )
      ]
    }
    case 'resend_verification': {
      return [
        body('session_id','Session ID is Invalid')
          .trim()
          .exists()
          .isLength({min:1})
      ]
    }
    case 'verification': {
    	return [
        body('session_id','Session ID is Invalid')
          .trim()
          .exists()
          .isLength({min:1}),
    		body('verify_code', 'Access Code is Invalid.')
    			.trim()
          .escape()
    			.exists()
    			.isLength({min:6,max:6}).withMessage('Access Code is not 6 digits long')
    			.isInt().withMessage('Access Code is not an integer')
    	]
    }
    case 'account': {
      return [
        body('session_id','Session ID is Invalid')
          .trim()
          .exists()
          .isLength({min:1})
      ]
    }
    case 'save_access_token': {
      return [
        body('session_id','Session ID is Invalid')
          .trim()
          .exists()
          .isLength({min:1}),
        body('access_token','Access Token for Bank Account is Invalid')
          .trim()
          .exists()
          .isLength({min:1}),
        body('item_id','Item ID for Bank Account is Invalid')
          .trim()
          .exists()
          .isLength({min:1})
      ]
    }
  }
}

exports.login = (request,response,next) => {
  // : Get original values from request body, as well as error results from validator
  var {email, password} = request.body,
      fingerprint = request.body.fingerprint || request.fingerprint.hash,
      {errors} = validationResult(request);

  // : If we got any errors, we send the user right back to the login form with the appropriate values
  if (errors.length > 0) {
    return sendResponse(response,404,false,'The provided email/password combination is invalid.');
  }

  var p = request.pool;
  p.getConnection(async(error,connection)=>{
    if (error) {
      let err = error.msg || error;
      return sendResponse(response, 503, false, err);
    }
    var query = 'SELECT id, legal_name, email, password, valid FROM Users WHERE email = ? LIMIT 1';
    var params = [email];
    var results = null;

    try {
      results = await performQuery(connection,query,params);
    } catch(e) {
      // If some error in query execution, we release the connection and reject w/ Error
      connection.release();
      let err = e.msg || e;
      return sendResponse(response, 503, false, err);
    }

    if (results.length == 0 || !verifyHash(password,results[0].password)) {
      connection.release();
      return sendResponse(response, 404, false, 'The provided email/password combination is invalid.');
    } 
  
    var user = results[0];
    var session_id = null,
        user_id = user.id,
        user_legal_name = user.legal_name,
        user_email = user.email,
        user_valid = user.valid,
        user_items = [],
        //currentDate = String(new Date().getTime()),
        fingerprint_hash = fingerprint;
     
    // : Get all banks (aka Items) associated with user
    query = 'SELECT item_id, access_token, active FROM `Items` WHERE user_id = ?';
    params = [user_id];
    try {
      user_items = await performQuery(connection, query, params);
    } catch(e) {
      // If some error in query execution, we release the connection and reject w/ Error
      connection.release();
      let err = e.msg || e;
      return sendResponse(response, 503, false, err);
    }

    // : Check if a session already exists that matches the user's id and fingerprint hash
    try {
      var userSessions = await performQuery(connection, 'SELECT session_id, fingerprint FROM User_Sessions WHERE user_id = ?', [user_id]);
      if (userSessions.length > 0) {
        var matchingSession = userSessions.find(s=>{
          return fingerprint_hash == s.fingerprint;
        });
        if (matchingSession) {
          sessionCreated = true;
          session_id = matchingSession.session_id;
          console.log(request.body);
        }
      }
    } catch(e) {
      let err = e.msg || e;
      return sendResponse(response, 503, false, err);
    }

    function sessionInterval(callback) {
      var attempts = 0;
      var sessionCreated = false;
      return setInterval(async()=>{
        if (!sessionCreated && attempts < 100) {
          console.log(attempts);
          attempts++;
          session_id = await createRandomHash();
          connection.query('INSERT INTO `USER_SESSIONS` (`session_id`, `user_id`, `fingerprint`) VALUES (?, ?, ?)', [session_id, user_id, fingerprint_hash],(e)=>{
           if(e && e.code != 'ER_DUP_ENTRY') {
              callback(false);
            }
            else {
              sessionCreated = true;
              callback(true);
            }
          });
        } else if (!sessionCreated && attempts >= 100) {
          callback(false);
        }
      }, 500);
    }

    const sessionLoop = new Promise((resolve,reject)=>{
      if (session_id) {
        resolve();
      } else {
        var p = sessionInterval((success)=>{
          if (success) {
            clearInterval(p)
            resolve();
          } else {
            clearInterval(p);
            reject();
          }
        });
      }
    });

    sessionLoop.then(()=>{
      connection.release();
      return sendResponse(response, 200, true, JSON.stringify({
        session_id:   session_id,
        _id:      user_id,
        _legal_name:  user_legal_name,
        _email:     user_email,
        _valid:     user_valid,
        _items:     user_items
      }));
    },()=>{
      connection.release();
      return sendResponse(response, 503, false, 'Your user session could not be created at this time. Please try again.');
    });
  });
}

exports.resend_verification = (request, response, next) => {
  // : Get session_id from request body, as well as error results from validator
  var {session_id} = request.body;
  var errors = validationResult(request);

  // : If we got any errors, we send the user right back to the login form with the appropriate values
  if (errors.length > 0) {
    return sendResponse(response,404,false,errors[0].msg);
  }

  var p = request.pool;
  p.getConnection(async(error,connection)=>{
    if (error) {
      let err = error.msg || error;
      return sendResponse(response, 503, false, err);
    }
    var query = 'SELECT t1.valid AS valid, t1.id AS id, t1.legal_name AS legal_name, t1.email AS email FROM `Users` AS t1 LEFT JOIN `User_Sessions` AS t2 ON t1.id = t2.user_id WHERE t2.session_id = ? LIMIT 1';
    var params = [session_id];
    var results = null;

    try {
      results = await performQuery(connection,query,params);
    } catch(e) {
      // If some error in query execution, we release the connection and reject w/ Error
      connection.release();
      let err = e.msg || e;
      return sendResponse(response, 503, false, err);
    }

    if (results.length == 0) {
      connection.release();
      return sendResponse(response, 404, false, 'The provided session does not exist within our Database!');
    }  
    else if (results[0].valid == true) {
      connection.release();
      return sendResponse(response, 404, false, 'Your account has already been verified.');
    }

    var user = results[0];
    var newCode = generateRandomNumber(6);
    var newCodeHash = createHash(newCode);

    try {
      await performQuery(connection,'UPDATE Verification_Hashes SET hash = ? WHERE id = ?',[newCodeHash, user.id]);
      var emailResults = await sendEmail('verification', {name:user.legal_name, code:newCode}, user.email);
    } catch(e) {
      connection.release();
      let err = e.msg || e;
      return sendResponse(response, 503, false, err);
    }
    connection.release();
    return sendResponse(response, 200, true, 'A new verification email containing your new Access Code has been sent!');
  });
};

exports.verify = (request, response, next) => {
  // : Get session_id and verification code from request body, as well as error results from validator
  var {session_id, verify_code} = request.body,
      {errors} = validationResult(request);
  // : If we got any errors, we send the user right back to the login form with the appropriate values
  if (errors.length > 0) {
    return sendResponse(response,404,false,errors[0].msg);
  }
  var p = request.pool;
  p.getConnection(async(error,connection)=>{
    if (error) {
      let err = error.msg || error;
      return sendResponse(response, 503, false, err);
    }
    var query = 'SELECT t1.hash AS hash, t1.id AS id FROM `Verification_Hashes` AS t1 LEFT JOIN `User_Sessions` AS t2 ON t1.id = t2.user_id WHERE t2.session_id = ? LIMIT 1';
    var params = [session_id];
    var results = null;
    try {
      results = await performQuery(connection,query,params);
    } catch(e) {
      // If some error in query execution, we release the connection and reject w/ Error
      connection.release();
      let err = e.msg || e;
      return sendResponse(response, 503, false, err);
    }
     if (results.length == 0) {
      connection.release();
      return sendResponse(response, 404, false, 'The provided session does not exist within our Database!');
    }  
    var user = results[0];
    var user_id = user.id;
    var hashToCompare = user.hash;
    if (!verifyHash(verify_code, hashToCompare)) {
      connection.release();
      return sendResponse(response, 404, false, 'The provided Access Code is incorrect.');
    }
    // : Initialize beginning of transactions since we're making some important changes here
    try {
      connection = await beginTransactions(connection);
    } catch(e) {
      connection.release();
      let err = e.msg || error;
      return sendResponse(response, 503, false, err);
    }

    // : Delete row from verification_hashes table, then update validity status of user
    try {
      await performQuery(connection, 'DELETE FROM `Verification_Hashes` WHERE id = ?',[user_id]);
      await performQuery(connection, 'UPDATE `Users` SET valid = true WHERE id = ?',[user_id]);
      // : now all finished, commit changes then return 200 status
      connection.commit(err=>{
        if (err) {
          connection.rollback(()=>{
            connection.release();
            let err = e.msg || error;
            throw err;
          }); 
        } else {
          connection.release();
          return sendResponse(response, 200, true, null);
        }
      });
    } catch(e) {
      connection.rollback(()=>{
        connection.release();
        let err = e.msg || error;
        return sendResponse(response, 503, false, err);
      }); 
    }
  });
}

exports.logout = (request, response, next) => {
  var {session_id} = request.body;
  var {errors} = validationResult(request);
  // : If we got any errors, we send the user right back to the login form with the appropriate values
  if (errors.length > 0) {
    return sendResponse(response,404,false,errors[0].msg);
  }
  var p = request.pool;
  p.getConnection(async(error,connection)=>{
    if (error) {
      let err = error.msg || error;
      return sendResponse(response, 503, false, err);
    }
    var query = 'DELETE FROM `User_Sessions` WHERE session_id = ?';
    var params = [session_id];
    try {
      await performQuery(connection, query, params);
      connection.release();
      return sendResponse(response, 200, true, null);
    } catch(e) {
      connection.release();
      let err = e.msg || error;
      return sendResponse(response, 503, false, err);
    }
  });
}

exports.account = (request, response, next) => {
  var {session_id} = request.body;
  var {errors} = validationResult(request);
  // : If we got any errors, we send the user right back to the login form with the appropriate values
  if (errors.length > 0) {
    return sendResponse(response,404,false,errors[0].msg);
  }
  var p = request.pool;
  p.getConnection(async(error,connection)=>{
    if (error) {
      let err = error.msg || error;
      return sendResponse(response, 503, false, err);
    }
    var query = 'SELECT t1.email AS email, t1.legal_name AS legal_name, t1.id AS id FROM `Users` AS t1 LEFT JOIN `User_Sessions` AS t2 ON t1.id = t2.user_id WHERE t2.session_id = ? LIMIT 1';
    var params = [session_id];
    var results = null;
    try {
      results = await performQuery(connection,query,params);
    } catch(e) {
      // If some error in query execution, we release the connection and reject w/ Error
      connection.release();
      let err = e.msg || e;
      return sendResponse(response, 503, false, err);
    }
     if (results.length == 0) {
      connection.release();
      return sendResponse(response, 404, false, 'The provided session does not exist within our Database!');
    }  
    var user = results[0];
    var user_items = [];

    query = 'SELECT t1.item_id AS item_id, t1.access_token AS access_token, t1.active AS active FROM `Items` AS t1 LEFT JOIN `User_Sessions` AS t2 ON t1.user_id = t2.user_id WHERE t2.session_id = ?';
    results = null;
    try {
      results = await performQuery(connection,query,params);
    } catch(e) {
      // If some error in query execution, we release the connection and reject w/ Error
      connection.release();
      let err = e.msg || e;
      return sendResponse(response, 503, false, err);
    }
    if (results.length > 0) {
      var pClient = request.plaid_client;
      var promisifiedItems = results.map((i)=> {
        return new Promise(resolve=>{
          let access_token = i.access_token;

          pClient.getItem(access_token, function(error, itemResponse) {
            if (error != null) {
              console.log(error);
              resolve();
            }
            // Also pull information about the institution
            pClient.getInstitutionById(itemResponse.item.institution_id, function(err, instRes) {
              if (err != null) {
                var msg = 'Unable to pull institution information from the Plaid API.';
                console.log(msg + '\n' + JSON.stringify(error));
                resolve();
              } else {
                pClient.getAccounts(access_token, function(error, accountsResponse) {
                  if (error != null) {
                    console.log(error);
                    resolve();
                  } else {
                    resolve({
                      item: itemResponse.item,
                      institution: instRes.institution,
                     account: accountsResponse
                    });
                  }
                });
              }
            });
          });
        });
      });
      Promise.all(promisifiedItems).then((items)=>{
        user_items = items.filter(i=>i!=null);
        connection.release();
        return sendResponse(response, 200, true, JSON.stringify({id: user.id, email:user.email, legal_name: user.legal_name, items: user_items}));
      })

    } else { 
      connection.release();
      return sendResponse(response, 200, true, JSON.stringify({id: user.id, email:user.email, legal_name: user.legal_name, items: user_items}));
    }
  });
}

exports.save_access_token = (request,response,next) => {
  var {session_id, access_token, item_id} = request.body;
  var {errors} = validationResult(request);
  // : If we got any errors, we send the user right back to the login form with the appropriate values
  if (errors.length > 0) {
    return sendResponse(response,404,false,errors[0].msg);
  }
  var p = request.pool;
  p.getConnection(async(error,connection)=>{
    if (error) {
      let err = error.msg || error;
      return sendResponse(response, 503, false, err);
    }
    var query = 'INSERT INTO `Items` (`user_id`, `item_id`, `access_token`) VALUES ((SELECT user_id FROM `User_Sessions` WHERE session_id = ? LIMIT 1), ?, ?)';
    var params = [session_id, item_id, access_token];
    try {
      await performQuery(connection, query, params);
      var new_items = await performQuery(connection, 'SELECT t1.item_id AS item_id, t1.access_token AS access_token, t1.active AS active FROM `Items` AS t1 LEFT JOIN `User_Sessions` AS t2 ON t1.user_id = t2.user_id WHERE t2.session_id = ?',[session_id]);
      connection.release();
      return sendResponse(response, 200, true, JSON.stringify(new_items));
    } catch(e) {
      // If some error in query execution, we release the connection and reject w/ Error
      connection.release();
      let err = e.msg || e;
      return sendResponse(response, 503, false, err);
    }
  });
}