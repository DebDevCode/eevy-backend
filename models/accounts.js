const mongoose = require("mongoose");

const accountSchema = mongoose.Schema({
  balance: Number,
});

const Account = mongoose.model("accounts", accountSchema);
module.exports = Account;
