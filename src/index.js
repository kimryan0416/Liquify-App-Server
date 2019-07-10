// LIQUIFY TEST BUILD WITH PLAID

// --------------------------------------------
// --- REQUIRE() STATEMENTS ---
// --------------------------------------------

// : Basic Node.js modules available by default
const fs = require('fs');
const util = require('util');
const path = require('path');

// : dotenv required for reading local '.env' file
require('dotenv').config({});

// : express-related modules
const express = require('express');
const fingerprint = require('express-fingerprint');	// For generating Fingerprint hashes for OS identification
//const expressValidator = require("express-validator");
//console.log(expressValidator);

// : Middleware necessary for Express and Liquify to run
const body_parser = require('body-parser');
const parseurl = require('parseurl');
const helmet = require('helmet');	// Secures Express APIs by defining various HTTP headers
const cors = require('cors');		// Allows for Cross-Origin Resource Sharing - configures Express to add headers stating that your API accepts requests coming from other origins
const https = require('https');
const mysql = require('mysql2');

// : PLAID API
const plaid = require('plaid');

// : Requiring local files
const { prettyPrintResponse } = require('./common.js');
const userRouter = require('../routes/user');
const adminRouter = require('../routes/admin');
const transactionsRouter = require('../routes/transactions');
const budgetsRouter = require('../routes/budgets');
const learnRouter = require('../routes/learn');


// --------------------------------------------
// --- SETTINGS SETUP
// --------------------------------------------

// : Determine if we are in production or development
const IN_PRODUCTION = process.env.IN_PRODUCTION === 'true';

// : We store the access_token in memory - in production, store it in a secure persistent data store
var ACCESS_TOKEN = null;
var PUBLIC_TOKEN = null;


// --------------------------------------------
// --- EXPRESS SETUP
// --------------------------------------------
// : Initializing Express
const app = express();


// --------------------------------------------
// --- HTTPS SETUP
// --------------------------------------------

// : Retrieving relevant Environment variables
const PORT = process.env.PORT || 8000;
const HTTPS_KEY = process.env.HTTPS_KEY;
const HTTPS_CERT = process.env.HTTPS_CERT;

// : Setting up HTTPS options
var httpsOptions = {
	key: fs.readFileSync(path.resolve(__dirname, HTTPS_KEY)),
	cert: fs.readFileSync(path.resolve(__dirname, HTTPS_CERT))
}

// --------------------------------------------
// --- MySQL SETUP
// --------------------------------------------

// : Retrieving relevant Environment variables
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || 'nekomimiForever11037';
const DB_NAME = process.env.DB_NAME || 'liquifyTestDatabase';

// : Create a MySQL Pool to better manage multiple connections
// At the moment, we're working with a connection limit of 10. Ideally, we'll be 
// 		increasing this number as the # of users we have increases, but we shouldn't
//		worry because the number of connections made is self-managing in that the
//		number of connections is lazily updated. All we need to make sure is that
//		whenever we create a connection, we close it when we're done with it.
//		Refer to: https://stackoverflow.com/questions/18496540/node-js-mysql-connection-pooling
const pool = mysql.createPool({
	connectionLimit: 10,
	host: DB_HOST,
	port: DB_PORT,
	user: DB_USER,
	password: DB_PASS,
	database: DB_NAME,
	insecureAuth: true
});


// --------------------------------------------
// --- PLAID SETUP
// --------------------------------------------

// : Retrieving relevant Environment variables
const CLIENT_NAME = process.env.CLIENT_APP_NAME || 'Liquify';
const PLAID_CLIENT_ID = process.env.CLIENT_ID;
const PLAID_PUBLIC_KEY = process.env.PUBLIC_KEY;
const PLAID_PRODUCTS = process.env.PLAID_PRODUCTS || 'transactions';
const ENVIRONMENT = process.env.ENVIRONMENT || 'sandbox';
const PLAID_COUNTRY_CODES = process.env.COUNTRY_CODES || 'US,CA,GB,FR,ES';
const PLAID_SECRET = (ENVIRONMENT == 'development') ? process.env.SECRET_DEVELOPMENT : process.env.SECRET_SANDBOX;

// : Creating our Plaid client
var client = new plaid.Client(
	PLAID_CLIENT_ID,
	PLAID_SECRET,
	PLAID_PUBLIC_KEY,
	plaid.environments[ENVIRONMENT],
	{clientApp: CLIENT_NAME}
);


// --------------------------------------------
// --- MIDDLEWARE SETUP
// --------------------------------------------

// : Setting up middleware for body_parser
app.use(body_parser.urlencoded({extended:false}));
app.use(body_parser.json());

// : Adding Helmet to enhance our app's API security
app.use(helmet());

// : Enabling CORS for all requests
app.use(cors());

// : Setting up Validator middlware
//app.use(expressValidator());

// : Setting up ability to generate Fingerprint hashes for device identification
app.use(fingerprint({
    parameters:[
        // Defaults
        fingerprint.useragent,
        fingerprint.acceptHeaders,
        fingerprint.geoip,
        // Additional parameters
        function(next) {
            // ...do something...
            next(null,{
            'param1':'value1'
            })
        },
        function(next) {
            // ...do something...
            next(null,{
            'param2':'value2'
            })
        },
    ]
}));

// : Setting up other middeware within each Request
app.use((req,res,next)=>{
	req.plaid_client = client;		// Saving our Plaid client
	req.pool = pool || null;	// Saving our MySQL pool
	next();
});


// --------------------------------------------
// --- ROUTE SETUP
// --------------------------------------------

// : For all user-related actions (logins, account creation, profile viewing ,etc), 
// 		we set a route to those request handlers
app.use('/user/',userRouter);
app.use('/admin/',adminRouter);
app.use('/transactions/',transactionsRouter);
app.use('/budgets/',budgetsRouter);
app.use('/learn/',learnRouter);

// --------------------------------------------
// --- SERVER SETUP
// --------------------------------------------

// : Begin hosting our server at the designated Port, if MySQL connection is existing
if (pool != null) {
	const server = https.createServer(httpsOptions, app).listen(PORT, ()=>{
		console.log("Liquify Sandbox: Listening in on port #"+PORT);
	});
} else {
	console.error("MySQL POOL CONNECTION NOT CREATED - INSPECT MySQL LOCALHOST SERVER AND DB CONDITION");
}