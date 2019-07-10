// LIQUIFY TEST BUILD WITH PLAID

// --------------------------------------------
// --- REQUIRE() STATEMENTS ---
// --------------------------------------------

const path = require('path');
// : Require Express and its router, alongside other express-related modules
const express = require('express');
const router = express.Router();
const Budget = require(path.join(__dirname, '../src/models/Budget.js'));


// --------------------------------------------
// --- BUDGETS LIST REQUEST HANDLING ---
// --------------------------------------------

router.post('/all', Budget.validate('all'), Budget.all);

router.post('/get', Budget.validate('get'), Budget.get);

// --------------------------------------------
// --- CREATE BUDGET REQUEST HANDLING ---
// --------------------------------------------

router.post('/create', Budget.validate('create'), Budget.create);

router.post('/edit', Budget.validate('create'), Budget.edit);


module.exports = router;