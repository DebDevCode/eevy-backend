const mongoose = require("mongoose");

const accountMovementSchema = mongoose.Schema({
  account: { type: mongoose.Schema.Types.ObjectId, ref: "accounts" }, // ref to account
  date: Date, // format to be defined: in principle the calendar date is sufficient
  amount: Number, // in euros
  isPositive: Boolean, // if true : credit , debit otherwise
  description: String, // text explaining whether it's a transfer or a reservation paiement
});

const AccountMovement = mongoose.model(
  "accountMovements",
  accountMovementSchema
);
module.exports = AccountMovement;
