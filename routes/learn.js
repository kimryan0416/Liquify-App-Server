// LIQUIFY TEST BUILD WITH PLAID

// --------------------------------------------
// --- REQUIRE() STATEMENTS ---
// --------------------------------------------

const path = require('path');
// : Require Express and its router, alongside other express-related modules
const express = require('express');
const router = express.Router();
const Learn = require(path.join(__dirname, '../src/models/Learn.js'));


// --------------------------------------------
// --- GETTING USER PROGRESS REQUEST HANDLING ---
// --------------------------------------------
router.post('/get', Learn.validate('session'), Learn.get);

// --------------------------------------------
// --- UPDATING USER PROGRESS REQUEST HANDLING ---
// --------------------------------------------
router.post('/update', Learn.validate('update'), Learn.update);

// --------------------------------------------
// --- CREATE BUDGET REQUEST HANDLING ---
// --------------------------------------------

module.exports = router;