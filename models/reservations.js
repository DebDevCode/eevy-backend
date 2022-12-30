const mongoose = require("mongoose");

const reservationSchema = mongoose.Schema({
  charger: { type: mongoose.Schema.Types.ObjectId, ref: "chargers" }, // reserved charger
  user: { type: mongoose.Schema.Types.ObjectId, ref: "users" }, // reserved by
  start: Date, // getTime() format : number of millseconds since 1970
  end: Date,
  price: Number,
  status: String, // initiated/accepted/done/cancelled
});

const Reservation = mongoose.model("reservations", reservationSchema);
module.exports = Reservation;
