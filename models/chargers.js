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
  brand: String,
  power: String,
  plugType: String,
  location: locationSchema,
  pricePerHour: Number,
  rating: Number,
  available: Boolean,
});

const Charger = mongoose.model("chargers", chargerSchema);
module.exports = Charger;
