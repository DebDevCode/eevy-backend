var express = require("express");
var router = express.Router();
const { checkBody } = require("../modules/checkBody");
const { getCoordinates } = require("../modules/getCoordinates");
const { getDates, getEndDate } = require("../modules/dates");
const User = require("../models/users");
const Reservation = require("../models/reservations");
const Charger = require("../models/chargers");
const moment = require("moment");

/////////////////////////////////////////////////////////////////////////////////////////////
// ROUTES :
// POST "/chargers/new" : create a new charger and attach it to the logged in user
// POST "/chargers/" :  returns all the chargers that are available now
// POST "/chargers/check" :  returns all the available chargers within a time range
// POST "/chargers/get" : route returns all the information about a given charger
// PUT "/changeAvailabilityStatus" : changes the availability status of the specified charger
/////////////////////////////////////////////////////////////////////////////////////////////

// helper fonction that implements both the POST / and the POST /check routes that are quite similar
const getListOfAvailableChargers = async (res, token, email, start, end) => {
  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    const user = await User.findOne({ token });
    if (!user || user.email != email) {
      return res.json({ result: false, error: "Invalid token" });
    }
    // find reservations that overlap with the specified time range
    // filter condition : status != done|cancelled &&
    //                    (reservation.end > start AND reservation.start < end)
    // populate with charger info. add 'isAvailable' in  filter condition.
    console.log("start:", start, "   end:", end);
    const bookedChargers = await Reservation.find({
      end: { $gt: start },
      start: { $lt: end },
      $or: [{ status: "initiated" }, { status: "accepted" }],
    }).populate("charger");
    let bookedChargersIds = [];
    console.log("bookedChargers:", bookedChargers);
    if (bookedChargers.length) {
      //unavailable chargers : build an array with their ids
      bookedChargersIds = bookedChargers.map((c) => c.charger._id);
      console.log("bookedChargersIds", bookedChargersIds);
    }
    // find all the available chargers
    const chargers = await Charger.find({
      available: true,
      // _id: {
      //   $nin: bookedChargersIds,
      // },
    });
    // send the response : in expected format
    res.json({
      result: true,
      chargers: chargers.map((charger) => {
        console.log("charger._id", charger._id);
        console.log("bookedChargersIds", bookedChargersIds);
        const isAvailable = !bookedChargersIds.find(
          (id) => id.toString() === charger._id.toString()
        );
        console.log(charger);
        return {
          _id: charger._id,
          brand: charger.brand,
          power: charger.power,
          plugType: charger.plugType,
          pricePerHour: charger.pricePerHour,
          available: isAvailable,
          latitude: charger.location.latitude,
          longitude: charger.location.longitude,
          street: charger.location.street,
          city: charger.location.city,
        };
      }),
    });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
};

// this route create a new charger and attach it to the logged in user
// expected parameters :
// token : String
// email: String
// brand: String
// power: Number
// plugType: String,
// pricePerhour: Number,
// street: String,
// city: String,
// latitude: Number,  // if not defined, will call a web service to get the coordinates of the city
// longitude: Number
// Returns:
//  { result: true }
// otherwise : {result: false, error:"error message"}
router.post("/new", async (req, res) => {
  if (
    !checkBody(req.body, [
      "token",
      "email",
      "power",
      "plugType",
      "pricePerHour",
      "num",
      "street",
      "zipCode",
      "city",
    ])
  ) {
    return res.json({ result: false, error: "Missing or empty fields" });
  }
  let {
    token,
    email,
    brand,
    power,
    plugType,
    pricePerHour,
    available,
    num,
    street,
    zipCode,
    city,
    latitude,
    longitude,
  } = req.body;

  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    let user = await User.findOne({ token });
    if (!user || user.email != email) {
      return res.json({ result: false, error: "Invalid token" });
    }
    if (!latitude || !longitude) {
      [latitude, longitude] = await getCoordinates(street, city);
    }
    console.log("latitude, longitude", latitude, longitude);
    const newCharger = new Charger({
      brand,
      power,
      plugType,
      pricePerHour,
      rating: 0,
      available,
      location: {
        num,
        street,
        zipCode,
        city,
        latitude,
        longitude,
      },
    });

    let doc = await newCharger.save();
    if (doc) {
      console.log("new charger id : ", doc._id);
      // attach the new charger to the logged in user's chargers list
      let ok = await User.updateOne(
        { _id: user._id },
        { $push: { chargers: doc._id } }
      );
      if (ok) {
        res.json({ result: true, newCharger });
      }
    }
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

/* this route returns all the chargers that are available now */
// should be a GET but we use a POST to hide the user token into the request body
// expected parameters :
// token : String
// email: String
// returns :
//    result:true
//    chargers : [{ id, power, plugType, pricePerHour,available, latitude, longitude}]
// otherwise :
//    result : false
//    error : "error message"
router.post("/", async (req, res) => {
  // check reqBody
  if (!checkBody(req.body, ["token", "email"])) {
    return res.json({ result: false, error: "Missing or empty fields" });
  }
  const { token, email } = req.body;
  // create "from" string
  const from = Date.now(); // now
  const duration = "00:05"; // arbitrarily set to 5mn
  const end = getEndDate(from, duration);
  await getListOfAvailableChargers(res, token, email, from, end);
});

/* this route returns all the available chargers within a time range */
// should be a GET but we use a POST to hide the user token into the request body
// expected parameters :
// token : String
// email: String
// from :String "YYYY-MM-DD HH:mm"
// to : String "YYYY-MM-DD HH:mm"
// returns :
//    result:true
//    chargers : [{ id, power, plugType, pricePerHour, available, latitude, longitude}]
// otherwise :
//    result : false
//    error : "error message"
router.post("/check", async (req, res) => {
  // check reqBody
  if (!checkBody(req.body, ["token", "email", "from", "to"])) {
    return res.json({ result: false, error: "Missing or empty fields" });
  }
  const { token, email, from, to } = req.body;
  const [start, end] = getDates([from, to]);
  console.log("start:", start, " - end : ", end);
  await getListOfAvailableChargers(res, token, email, start, end);
});

// this route returns all the information about a given charger
// should be a GET but we use a POST to hide the user token into the request body
// expected parameters:
// token : String
// email: String
// charger: ID
// Returns :
//    result:true
//    charger: { owner: {id, lastName,firstName tel,rating},
//              brand, power, plugType, pricePerHour,available,chargerRating, chargerComments
//              location:{street , city , latitude ,  longitude ,}
//             }
// otherwise :
//    result : false
//    error : "error message"
router.post("/get", async (req, res) => {
  // check reqBody
  if (!checkBody(req.body, ["token", "email", "chargerId"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  const { token, email, chargerId } = req.body;
  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    const user = await User.findOne({ token });
    if (!user || user.email != email) {
      res.json({ result: false, error: "Invalid token" });
      return;
    }
    // get the charger info from the chargers collection
    const charger = await Charger.findById(chargerId);
    if (!charger) {
      return res.json({ result: false, error: "charger not found" });
    }
    // charger found : find the charger owner by querying the user collection for
    // the presence of "chargerId" in the "chargers" array of foreign keys
    const owner = await User.findOne({ chargers: { $in: [chargerId] } });
    if (!owner) {
      return res.json({
        result: false,
        error: "charger's owner not found",
      });
    }
    // filter the user comments to get only those of the requested charger
    console.log("user.comments:", user.comments);
    const chargerComments = user.comments.filter(
      (c) => c.charger.toString() === chargerId
    );
    // calculate the rating of the charger
    const chargerRating =
      chargerComments.reduce((acc, cur) => acc + cur.rating, 0) /
      chargerComments.length;
    // owner has been found : build the response

    res.json({
      result: true,
      charger: {
        owner: {
          id: owner._id,
          lastName: owner.lastName,
          firstName: owner.firstName,
          email: owner.email,
          tel: owner.tel,
          rating: owner.rating,
          profilPic: owner.profilPic,
        },
        brand: charger.brand,
        power: charger.power,
        plugType: charger.plugType,
        pricePerHour: charger.pricePerHour,
        available: charger.available,
        chargerRating,
        chargerComments,
        location: charger.location,
      },
    });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

/* this route changes the availability status of the specified charger */
// expected parameters :
// token : String
// email: String
// charger: ID
// status : Boolean
// returns :
//    result:true
//
// otherwise :
//    result : false
//    error : "error message"
router.put("/changeAvailabilityStatus", async (req, res) => {
  // check reqBody
  if (!checkBody(req.body, ["token", "email", "charger", "status"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  const { token, email, charger, status } = req.body;
  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    const user = await User.findOne({ token });

    if (!user || user.email != email) {
      res.json({ result: false, error: "Invalid token" });
      return;
    }
    // console.log("user.chargers",user.chargers);
    // console.log("chargerId",chargerId)
    // check that the charger belongs to the user
    if (!user.chargers.map((c) => c.toString()).includes(charger)) {
      return res.json({
        result: false,
        error: "specified charger does not belong to the user",
      });
    }
    // update the availability status of the charger in the chargers collection
    await Charger.findOneAndUpdate(
      { _id: charger },
      { $set: { available: status } }
    );
    res.json({ result: true, status });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

router.delete("/deleteBorne", async (req, res) => {
  if (!checkBody(req.body, ["token", "email", "chargerId"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  } else {
    const { token, email, chargerId } = req.body;
    const user = await User.findOneAndUpdate(
      { token },
      { $pull: { chargers: chargerId } }
    );
    if (!user || user.email != email) {
      return res.json({ result: false, error: "Invalid token" });
    } else {
      const chargerDeleted = await Charger.findByIdAndDelete(chargerId);

      res.json({ result: true, chargerDeleted: chargerDeleted });
    }
  }
});

module.exports = router;
