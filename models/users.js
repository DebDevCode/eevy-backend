const mongoose = require("mongoose");

const ribSchema = mongoose.Schema({
  iban: String,
  bicCode: String,
});

const accountSchema = mongoose.Schema({
  balance: Number,
  movements: [accountMovementSchema],
});

const accountMovementSchema = mongoose.Schema({
  date: Date, // format to be defined: in principle the calendar date is sufficient
  amount: Number, // in euros
  isPositive: Boolean, // if true : credit , debit otherwise
  description: String, // text explaining whether it's a transfer or a reservation paiement
});

const commentSchema = mongoose.Schema({
  rating: Number,
  date: Date,
  comment: String,
  from: String,
  charger: { type: mongoose.Schema.Types.ObjectId, ref: "chargers" },
});

const userSchema = mongoose.Schema({
  lastName: String,
  firstName: String,
  password: String,
  token: String,
  email: String,
  tel: String,
  profilPic: String,
  rating: Number,
  comments: [commentSchema],
  RIB: ribSchema,
  account: accountSchema,
  recentPlaces: [String],
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "chargers" }],
  chargers: [{ type: mongoose.Schema.Types.ObjectId, ref: "chargers" }],
});

const User = mongoose.model("users", userSchema);

module.exports = User;
