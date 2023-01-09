const mongoose = require("mongoose");

const reservationSchema = mongoose.Schema({
  charger: { type: mongoose.Schema.Types.ObjectId, ref: "chargers" },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  start: Date,
  end: Date,
  price: Number,
  status: String,
});

const Reservation = mongoose.model("reservations", reservationSchema);
module.exports = Reservation;
