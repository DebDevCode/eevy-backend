const mongoose = require("mongoose");
const ribSchema = mongoose.Schema({
  IBAN: String,
  BIC: String,
  accountHolder: String,
});
const commentSchema = mongoose.Schema({
  rating: Number,
  date: Date,
  comment: String,
  from: String,
  charger: { type: mongoose.Schema.Types.ObjectId, ref: "chargers" },
});

const userSchema = mongoose.Schema({
  // identity of user
  lastName: String,
  firstName: String,
  password: String,
  token: String,
  email: String,
  tel: String,
  profilPic: String,
  // user's car info
  // carModel: String,
  // batteryCapacity: Number,
  // ratings
  rating: Number, // average of  all ratings
  comments: [commentSchema],
  // account
  RIB: ribSchema, // bank details for money transfers
  account: { type: mongoose.Schema.Types.ObjectId, ref: "accounts" }, // the EEVY account of teh user
  // recent search :  cities
  recentPlaces: [String],
  // favorite chargers
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "chargers" }],
  // the following field is for charger owners: array because a user can have several chargers
  chargers: [{ type: mongoose.Schema.Types.ObjectId, ref: "chargers" }],
});

const User = mongoose.model("users", userSchema);

module.exports = User;
