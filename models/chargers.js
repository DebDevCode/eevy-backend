const mongoose = require("mongoose");

const locationSchema = mongoose.Schema({
  num: Number,
  street: String,
  zipCode: Number,
  city: String,
  latitude: Number,
  longitude: Number,
});

const chargerSchema = mongoose.Schema({
  // charger characteristics
  brand: String,
  power: Number,
  plugType: String,
  // charger address as sub document
  location: locationSchema,
  // price per hour
  pricePerHour: Number,
  rating: Number,
  available: Boolean, // switched off (false) when charger shall not show in new search requests
});

const Charger = mongoose.model("chargers", chargerSchema);
module.exports = Charger;
