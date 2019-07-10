// : dotenv required for reading local '.env' file
require('dotenv').config({});
	// : Get our Encryption key from our environment variables
	const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
const util = require('util');
const path = require('path');
const Cryptr = require('cryptr');
	const cryptr = new Cryptr(ENCRYPTION_SECRET);
const crypto = require('crypto');	// : DEFAULT NODE APP - DO NOT DELETE
const bcrypt = require('bcrypt');
	const saltRounds = 10;
const nodemailer = require("nodemailer");
const ejs = require("ejs");

// : Offered by 'momomo' on stack overflow: https://stackoverflow.com/questions/21816595/how-to-generate-a-random-number-of-fixed-length-using-javascript
function generateRandomNumber(n) {
	var add = 1, max = 12 - add;   // 12 is the min safe number Math.random() can generate without it starting to pad the end with zeros.   

	if ( n > max ) {
		return generateRandomNumber(max) + generateRandomNumber(n - max);
	}

	max        = Math.pow(10, n+add);
	var min    = max/10; // Math.pow(10, n) basically
	var number = Math.floor( Math.random() * (max - min + 1) ) + min;

	return ("" + number).substring(add); 
}

// : Checks if any provided value is an Array specifically or not
const isArray = a => {	
	return Object.prototype.toString.call(a) === "[object Array]";	
}

// : Pretty prints error responses
const prettyPrintResponse = response => {
  console.log(util.inspect(response, {colors: true, depth: 4}));
};

const encryptData = (data) => {
	var toEncrypt = (typeof data === 'object') ? JSON.stringify(data) : data;
	return cryptr.encrypt(toEncrypt);
}

const decryptData = (encryptedString) => {
	return cryptr.decrypt(encryptedString);
}

// : Creating a hash from a password or any given string
const createHash = (phrase) => {
	var salt = bcrypt.genSaltSync(saltRounds);
	var hash = bcrypt.hashSync(phrase, salt);
	return hash;
}

// : Verifying if a provided string and a hash are valid
const verifyHash = (phrase, hash) => {
	return bcrypt.compareSync(phrase, hash);
}

// : Generates new random hashes that are randomized and are hashed by SHA256 - great for ID's and session ID's
const createRandomHash = () => { 
	return new Promise((resolve,reject)=>{
		crypto.randomBytes(256, function(err, buf) { 
			if (err) { 
				reject(err);
			} 
			var sha = crypto.createHash('sha256'); 
			sha.update(buf);
			resolve(sha.digest('hex'));
		});
	});
}

// : Creating Connection with MySQL pool
const createConnection = pool => {
	return new Promise((resolve,reject)=>{
		pool.getConnection((error,connection)=>{
			if (error) {
				return reject(error);
			}
			return resolve(connection);
		});
	});
}

const releaseConnection = (connection) => {
	if (connection == null) return;
	return connection.release();
}

// : Rolling Back Transactions
const rollbackTransactions = (connection) => {
	return new Promise((resolve)=>{
		if(connection==null) { 
			connection.release();
			resolve(); 
		}
		else {
			connection.rollback(()=>{
				releaseConnection(connection);
				resolve();
			});
		}
	});
}

// : Beginning Transactions
const beginTransactions = (connection) => {
	return new Promise((resolve,reject)=>{
		if (connection==null) { reject("Connection isn't defined."); }
		connection.beginTransaction((error)=>{
			if(error) reject(error);
			else resolve(connection);
		});
	})
}

// : Performing a Query in a Transaction
const performQuery = (connection,query,params=[]) => {
	return new Promise((resolve,reject)=>{
		// If connection or query are nonexistent, we reject with an error
		if (connection == null) 
			reject("Provided connection is nonexistent - must provide a proper connection!");
		if (typeof query !== 'string' || query.length == 0) 
			reject("Provided query is either not a string or it has a length of 0");
		if (!isArray(params)) 
			reject("Provided parameters for query are not in an array format");

		// Perform the provided query
		connection.query(query, params, (err, results)=>{
			// If some error in query execution, we push a rollback and reject w/ Error
			if (err) reject(err);
			else resolve(results);
		});
	});
}

// : Committing Transactions
const commitTransaction = (connection) => {
	return new Promise((resolve,reject)=>{
		if(connection==null) { reject("Connection isn't defined."); }
		connection.commit(err=>{
			if (err) reject(err);
			else {
				releaseConnection(connection);
				resolve();
			}
		});
	});
}

// : Sending Emails to a specific user
function sendEmail(type, content, receiver) {
	return new Promise((resolve,reject)=>{
		// Generate test SMTP service account from ethereal.email
		// Only needed if you don't have a real mail account for testing
		nodemailer.createTestAccount((err,testAccount)=>{
			if (err) {
				reject(err);
			}
			// create reusable transporter object using the default SMTP transport
			let transporter = nodemailer.createTransport({
				name: 'liquify.com',
				host: "smtp.gmail.com",
				port: 465,
				secure: true, // true for 465, false for other ports
				auth: {
					type: 'OAuth2',
					clientId: '427500382566-o11e4uu83n7e73mcoc8snf5i70vq3f7c.apps.googleusercontent.com',
					clientSecret: 'NB9_FbasgTsHf-XOIbZGylWD'
				}
			});

			var renderPath = '../';
			switch(type) {
				case('verification'):
					// Content = name of user & verification code
					renderPath = path.resolve(__dirname,"../views/templates/accountVerification.ejs");
					break;
			}

			ejs.renderFile(renderPath, content, function (err, data) {
				if (err) {
					reject(err);
				}
				
				// : Set up mailing options such as data, receiver, etc.
				var mailOptions = {
					from: '"Liquify Team" <kimryan0416@gmail.com>', // sender address
					to: receiver,
					subject: "Liquify - Your Account Verification Code", // Subject line
					html: data,
					auth: {
						user: 'kimryan0416@gmail.com',
						refreshToken: '1/l-54sR_wLkssjs8S-C3ZOFNDxcKl-teMN5k2BPP-f80',
						accessToken: 'ya29.GlsiBzOF89Pq37S2Pvk2p0W7Lhz4d64HdBf3YmDWAoFqJMZawNWD_wdCHMcqBfFGOEv7py1EnruuTkitx3DtlZrxlSKPSkKBxDIlPVYcbKrfUVuBZJeHg1MQ0vnl'
					}
				}

				// : Send mail with defined transport object
				transporter.sendMail(mailOptions, (err,info)=>{
					if (err) {
						reject(err);
					}
					resolve({
						messageId: info.messageId,
						url: nodemailer.getTestMessageUrl(info)
					});
				});
			});
		});
	});
}

module.exports = {
	prettyPrintResponse,
	createHash,
	createRandomHash,
	generateRandomNumber,
	verifyHash,
	createConnection,
	rollbackTransactions,
	beginTransactions,
	performQuery,
	commitTransaction,
	sendEmail,
	isArray,
	encryptData,
	decryptData,
}