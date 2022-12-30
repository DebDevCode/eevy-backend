var express = require("express");
var router = express.Router();
const { checkBody } = require("../modules/checkBody");
const Reservation = require("../models/reservations");
const User = require("../models/users");
const AccountMovement = require("../models/accountMovements");

const {
  getDates,
  formatDateToStr,
  calculateTimeToDate,
  calculateAllTimeToDate,
} = require("../modules/dates");
const Account = require("../models/accounts");

// helper function
const formatReservation = (r) => {
  const duration = `${formatDateToStr(r.start, "H[h]mm")} - ${formatDateToStr(
    r.end,
    "H[h]mm"
  )}`;
  return {
    id: r._id,
    charger: r.charger._id,
    power: r.charger.power,
    address: `${r.charger.location.num} ${r.charger.location.street}, ${r.charger.location.zipCode} ${r.charger.location.city}`,
    date: formatDateToStr(r.start, "D MMM YYYY"),
    duration,
    price: `${r.price} €`,
    ownerId: r.user._id,
  };
};
///////////////////////////////////////////////////////////////////
//    /reservations     ROUTES
// POST /reservations/new : create a new reservation
// POST /reservations/user: returns all the reservations of a given user
//
///////////////////////////////////////////////////////////////////

/* potentially useful lines
Création d'un objet Moment à partir de la chaîne de caractères "YYYY-MM-DD HH:mm:ss"
const date = moment("2022-12-14 18:30:00", "YYYY-MM-DD HH:mm:ss").toDate();;

Conversion de l'objet Moment en objet Date
const dateObject = date.toDate();
*/

/*  this route creates a new reservation
Expected parameters:
token : String
email : String
chargerId: id 
from :String "YYYY-MM-DD HH:mm"
to : String "YYYY-MM-DD HH:mm"
price : Number
Returns  
    {
        result:true
    }
    Otherwise : { result: false, error "error message"}
*/
router.post("/new", async (req, res) => {
  if (
    !checkBody(req.body, ["token", "email", "chargerId", "from", "to", "price"])
  ) {
    return res.json({ result: false, error: "Missing or empty fields" });
  }
  const { token, email, chargerId, from, to, price } = req.body;
  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    const user = await User.findOne({ token });
    if (!user || user.email != email) {
      res.json({ result: false, error: "Invalid token" });
      return;
    }
    const [start, end] = getDates([from, to]);
    const newReservation = new Reservation({
      charger: chargerId, // reserved charger
      user: user._id, // reserved by
      start,
      end,
      price,
      status: "initiated",
    });
    await newReservation.save();
    res.json({ result: true, newReservation });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

// this route returns all the reservations of a given user: the returned reservations are grouped by status
// ongoing, past, upcoming
// should be a GET, but e use a POST route to hide the secure token into the encrypted request body
// Expected parameters:
// token : String
// email : String
// user: id
// Returns
//     {
//         result:true,
//         onGoing : {id : reservation id, charger : charger ID,
//                     duration: "start time - end-time", price :"price €",
//                     [timeToEnd(only if onGoing reservation)]}
//         past: [ {id : reservation id, charger : charger ID, date,
//                  duration: "start time - end-time", price :"price €", }]
//         upcoming : [idem past]
// //     }
//     Otherwise : { result: false, error "error message"}
router.post("/user", async (req, res) => {
  if (!checkBody(req.body, ["token", "email"])) {
    return res.json({ result: false, error: "Missing or empty fields" });
  }
  const { token, email } = req.body;
  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    const user = await User.findOne({ token });
    if (!user || user.email != email) {
      res.json({ result: false, error: "Invalid token" });
      return;
    }
    // find all reservations done by the input user
    const reservations = await Reservation.find({ user })
      .populate("charger")
      .populate("user");
    // sort the reservations byStatus
    const now = Date.now();
    const dateLocale = new Date();
    const offset = 60 * 60000;
    const localeNow = now + offset;
    const past = reservations
      .filter((r) => r.end < localeNow)
      .map(formatReservation);
    const upcoming = reservations
      .filter((r) => r.start > localeNow)
      .map(formatReservation);
    const current = reservations.find(
      (r) => r.start <= localeNow && r.end > localeNow
    );

    let ongoing = {};
    if (current) {
      ongoing = formatReservation(current);
      delete ongoing.date;
      ongoing.timeToEnd = calculateTimeToDate(current.end);
      ongoing.resaTime = calculateAllTimeToDate(current.start, current.end);
    }
    // format the reservations as expected by the route
    res.json({
      result: true,
      ongoing,
      past,
      upcoming,
    });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

// PUT /accept : charger owner accepts or refuse a reservation request
// this route either changes the status of the input reservation to 'accepted'
// or delete the input reservation if the owner rejects the request
// Expected Parameters :
// token : String
// email : String
// reservation : id
// accept : Boolean
// Returns
//     {  result:true }
// Otherwise : { result: false, error "error message"}
router.put("/accept", async (req, res) => {
  if (!checkBody(req.body, ["token", "email", "reservation", "accept"])) {
    return res.json({ result: false, error: "Missing or empty fields" });
  }
  const { token, email, reservation, accept } = req.body;
  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    const user = await User.findOne({ token });
    if (!user || user.email != email) {
      res.json({ result: false, error: "Invalid token" });
      return;
    }
    let doc, err;
    const filter = { _id: reservation, user: user._id };
    if (accept === "true") {
      // update the status of the reservation to 'accepted'
      doc = await Reservation.updateOne(filter, {
        $set: { status: "accepted" },
      });
      err = !doc.matchedCount;
    } else {
      // delete the reservation
      doc = await Reservation.deleteOne(filter);
      err = !doc.deletedCount;
    }
    if (err) {
      return res.json({
        result: false,
        error: "You are not the owner of the reserved charger",
      });
    }
    res.json({ result: true });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

// POST /reservations/pay : payment of a reservation
// expected Parameters:
// token : String
// email : String
// reservation:id,
// Returns:
// { result:true, balance:<updated amount>}
// Otherwise
// {result : false}
router.post("/pay", async (req, res) => {
  if (!checkBody(req.body, ["token", "email", "reservation"])) {
    return res.json({ result: false, error: "Missing or empty fields" });
  }
  const { token, email, reservation } = req.body;
  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    const user = await User.findOne({ token }).populate("account");
    if (!user || user.email != email) {
      res.json({ result: false, error: "Invalid token" });
      return;
    }
    // get the reservation
    const reservObj = await Reservation.findById(reservation);
    if (!reservObj) {
      return res.json({ result: false, error: "Invalid reservation ID" });
    }

    // check the user's balance
    if (user.account.balance < reservation.price) {
      return res.json({
        result: false,
        error: "Not enough amount on your account",
      });
    }

    // find the owner of the reserved charger
    console.log("reservObj", reservObj);
    const owner = await User.findOne({
      chargers: { $in: [reservObj.charger] },
    }).populate("account");
    if (!owner) {
      return res.json({
        result: false,
        error: "Cannot find the owner of the reserved charger",
      });
    }
    // create an  debit movement for user
    const newDebitMvt = new AccountMovement({
      account: user.account._id, // ref to account
      date: Date.now(),
      amount: reservObj.price, // in euros
      isPositive: false,
      description: `Reservation of ${owner.firstName} ${
        owner.lastName
      } 's charger on ${formatDateToStr(reservObj.start, "D MMM YY")}`,
    });
    const debitMvt = await newDebitMvt.save();
    if (debitMvt) {
      // create a credit movement for the owner
      const newCreditMvt = new AccountMovement({
        account: owner.account._id, // ref to account
        date: Date.now(),
        amount: reservObj.price, // in euros
        isPositive: true,
        description: `Charger reservation from ${user.firstName} ${
          user.lastName
        } on ${formatDateToStr(reservObj.start, "D MMM YY")}`,
      });
      const crediMvt = await newCreditMvt.save();
      if (!crediMvt) {
        // error : cancel the previous debit movement
        await AccountMovement.deleteOne(debitMvt._id);
      } else {
        // now update the accounts balances
        const userBalance = user.account.balance - reservObj.price;

        const doc = await Account.updateOne(
          { _id: user.account._id },
          { $set: { balance: userBalance } }
        );
        console.log("doc:", doc);
        if (doc.modifiedCount) {
          const ownerBalance = owner.account.balance + reservObj.price;
          console.log("ownerBalance", ownerBalance);
          const docOwner = await Account.updateOne(
            { _id: owner.account._id },
            { $set: { balance: ownerBalance } }
          );
          if (docOwner.modifiedCount) {
            return res.json({ result: true, balance: userBalance });
          }
        }
      }
    }
    return res.json({ result: false, error: "Database Error" });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

const formatResa = (r) => {
  const duration = `${formatDateToStr(r.start, "H[h]mm")} - ${formatDateToStr(
    r.end,
    "H[h]mm"
  )}`;
  return {
    id: r._id,
    date: formatDateToStr(r.start, "D MMM YYYY"),
    duration,
    price: `${r.price} €`,
    user: r.user.firstName + " " + r.user.lastName,
    userRating: r.user.rating,
    userPic: r.user.profilPic,
  };
};

router.post("/charger", async (req, res) => {
  if (!checkBody(req.body, ["token", "email", "charger"])) {
    return res.json({ result: false, error: "Missing or empty fields" });
  }
  const { token, email, charger } = req.body;

  try {
    const user = await User.findOne({ token });
    if (!user || user.email != email) {
      res.json({ result: false, error: "Invalid token" });
      return;
    }

    const reservations = await Reservation.find({ charger })
      .populate("charger")
      .populate("user");

    const now = Date.now();
    const offset = 60 * 60000;
    const localeNow = now + offset;

    const past = reservations
      .filter((r) => r.end < localeNow)
      .map((r) => formatResa(r));

    const upcoming = reservations
      .filter((r) => r.start > localeNow)
      .map((r) => formatResa(r));

    const current = reservations.find(
      (r) => r.start <= localeNow && r.end > localeNow
    );

    let ongoing = {};

    if (current) {
      ongoing = formatResa(current);
      delete ongoing.date;
      ongoing.timeToEnd = calculateTimeToDate(current.end);
      ongoing.resaTime = calculateAllTimeToDate(current.start, current.end);
    }

    res.json({
      result: true,
      ongoing,
      past,
      upcoming,
    });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

module.exports = router;
