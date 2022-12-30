var express = require("express");
const Charger = require("../models/chargers");
const User = require("../models/users");
const Account = require("../models/accounts");
var router = express.Router();
const { checkBody } = require("../modules/checkBody");
const uid2 = require("uid2");
const bcrypt = require("bcrypt");
const NB_MAX_RECENT = 10;
const moment = require("moment");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const uniqid = require("uniqid");

/************************************************************************************ 
 ROUTES :
POST /users/signup : creates a new user
POST /users/signin : set the logged-in user
POST /users/addRecentPlace : adds a new City to the list of recent cities 
      searched by the input user
POST /users/favoriteChargers :returns all the favorite chargers of a specified user
PUT /users/updateFavorites : add a charger to the list of favorites chargers of the logged-in user
                            if the charger is already in the list remove it from the list
POST /users/addComment :updates the list of comments (add a new review) and the rating
      of the input user
POST /users/getComments : returns all the reviews about a user
************************************************************************************/
// /signup : this route creates a new user and return its token
// Expected parameters :
// mandatory :
// email:String,
// password : String,
// firstName: String,
// lastName: String,
// Optional :
// tel: String,
// IBAN: String,
// BIC: String,
// accountHolder: String,
// Returns :
//{ result: true, token: newUser.token }
// Otherwise:
//{ result: false, error: "Error message" }
router.post("/signup", async (req, res) => {
  if (!checkBody(req.body, ["email", "password", "firstName", "lastName"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  const {
    email,
    password,
    firstName,
    lastName,
    tel,
    IBAN,
    BIC,
    accountHolder,
  } = req.body;
  try {
    // check if a user withsame email already exists in db
    const data = await User.findOne({ email });
    if (data) {
      return res.json({ result: false, error: "User already exists" });
    }
    // encrypt the password
    const hash = bcrypt.hashSync(password, 10);
    // create an account for the user
    const newAccount = new Account({
      balance: 0,
    });
    const account = await newAccount.save();

    const newUser = new User({
      email,
      password: hash,
      firstName,
      lastName,
      token: uid2(32), // generates a unique token for the new user
      tel,
      profilPic: "../assets/eevy-logo-2.png",
      // ratings
      rating: 0,
      comments: [],
      // account
      RIB: {
        IBAN,
        BIC,
        accountHolder,
      }, // bank details for money transfers
      account: account ? account._id : null, // the EEVY account of the user
      recentPlaces: [],
      favorites: [],
      chargers: [],
    });

    const user = await newUser.save();
    if (newUser) {
      res.json({ result: true, token: user.token });
    } else {
      res.json({ result: false, error: "database error" });
    }
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

// /signin : this route sets the logged-in user and return its token
// Expected parameters :
// email:String,
// password : String,
//
// Returns :
//{ result: true, token, user }
// Otherwise:
//{ result: false, error: "Error message" }
router.post("/signin", async (req, res) => {
  if (!checkBody(req.body, ["email", "password"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email })
      .populate("chargers")
      .populate("account");
    if (user && bcrypt.compareSync(password, user.password)) {
      // user has been found and his password has been checked
      res.json({ result: true, token: user.token, user });
    } else {
      res.json({ result: false, error: "User not found or wrong password" });
    }
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});
/* this route adds a new City to the list of recent cities searched by the input user */
// expected parameters :
// token : String
// email : String
// city : String
// returns :
//    result:true
// otherwise :
//    result : false
//    error : "error message"
router.put("/addRecentPlace", async (req, res) => {
  if (!checkBody(req.body, ["token", "email", "city"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  let { token, email, city } = req.body;
  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    const user = await User.findOne({ token });
    if (!user || user.email != email) {
      return res.json({ result: false, error: "Invalid token" });
    }
    let recentPlaces = user.recentPlaces;
    city = city.trim().toUpperCase();
    if (!recentPlaces.includes(city)) {
      // the input city is not part of the favorites
      if (recentPlaces.length === NB_MAX_RECENT) {
        // list of recent places full : remove the oldest one
        recentPlaces.pop();
      }
      recentPlaces.unshift(city);
    }

    await User.updateOne({ _id: user._id }, { $set: { recentPlaces } });
    res.json({ result: true });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

/* this route returns all the favorite chargers of a specified user */
// should be a GET but we use a POST to hide the user token into the request body
// expected parameters :
// token : String
// email : String
// returns :
//    result:true
//    favorites : [ ids ]
// otherwise :
//    result : false
//    error : "error message"
router.post("/favoriteChargers", async (req, res) => {
  if (!checkBody(req.body, ["token", "email"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  const { token, email } = req.body;
  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    const user = await User.findOne({ token }).populate("favorites");
    if (!user || user.email != email) {
      return res.json({ result: false, error: "Invalid token" });
    }
    res.json({
      result: true,
      favorites: user.favorites,
    });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

// this route updates the list of comments (add a new review) and the rating of the input user
// expected parameters :
// token : String  // logged in user writing the comment
// email : String
// ownerID : String // id of the user concerned by the comment
// comment : String
// rating : Number (between 1 and 5)
// returns :
//    result:true
// otherwise :
//    result : false
//    error : "error message"
router.put("/addComment", async (req, res) => {
  if (
    !checkBody(req.body, [
      "token",
      "email",
      "ownerID",
      "comment",
      "rating",
      "chargerId",
    ])
  ) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  const { token, email, ownerID, comment, rating, chargerId } = req.body;
  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    const user = await User.findOne({ token });
    if (!user || user.email != email) {
      return res.json({ result: false, error: "Invalid token" });
    }
    const owner = await User.findById(ownerID);
    if (!owner) {
      return res.json({ result: false, error: "Unknown charger's owner" });
    }
    // calculate the new rating of the owner (update the average of all ratings)
    const newRating =
      (owner.rating * owner.comments.length + Number(rating)) /
      (owner.comments.length + 1);
    console.log("newRating", newRating);
    // add the new comment to the owner's list of comments
    owner.comments.unshift({
      rating,
      date: new Date(),
      comment,
      from: `${user.firstName} ${user.lastName}`,
      charger: chargerId,
    });
    const doc = await User.updateOne(
      { _id: ownerID },
      { $set: { comments: owner.comments, rating: newRating } }
    );
    res.json({ result: true });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});
// this route returns all the reviews about a user
// should be a GET route, but we use POST to hide the token into the request body
// Expected Parameters
// token : String  // logged in user writing the comment
// email : String
// ownerID : String // id of the user we want the reviews of
// returns :
//    result: true
//    comments : array of comments
// otherwise :
//    result : false
//    error : "error message"
router.post("/getComments", async (req, res) => {
  if (!checkBody(req.body, ["token", "email", "ownerID"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  const { token, email, ownerID } = req.body;
  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    const user = await User.findOne({ token }).populate("favorites");
    if (!user || user.email != email) {
      return res.json({ result: false, error: "Invalid token" });
    }
    const owner = await User.findById(ownerID);
    if (!owner) {
      return res.json({ result: false, error: "Unknown charger's owner" });
    }
    //reformat the date of the comments
    const comments = owner.comments.map((c) => {
      const dateStr = moment(c.date).format("DD MMM YYYY");
      return {
        rating: c.rating,
        date: dateStr,
        comment: c.comment,
        from: c.from,
      };
    });
    res.json({ result: true, comments });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

// PUT /users/updateFavorites : add a charger to the list of favorites chargers of the logged-in user
//                              if the charger is already in the list remove it from the list
// Expected Parameters :
// token : String  // logged in user
// email : String
// charger : id
// returns :
//    result:true
// otherwise :
//    result : false
//    error : "error message"
router.put("/updateFavorites", async (req, res) => {
  if (!checkBody(req.body, ["token", "email", "charger"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  const { token, email, charger } = req.body;
  try {
    // check user : find user with passed token (check that the passed email matches the user's the email
    // to avoid user usurpation from another EEVY user)
    const user = await User.findOne({ token });
    if (!user || user.email != email) {
      return res.json({ result: false, error: "Invalid token" });
    }
    // check that the charger exist
    const foundCharger = await Charger.findById(charger);
    if (!foundCharger) {
      return res.json({ result: false, error: "Invalid charger ID" });
    }
    // check if the charger is already in the favorites
    let update; // update action to perform
    if (user.favorites.find((c) => c.toString() === charger)) {
      // charger is already there : the update will be a pull
      update = { $pull: { favorites: charger } };
    } else {
      update = { $push: { favorites: charger } };
    }
    const doc = await User.updateOne({ token }, update);
    res.json({ result: true });
  } catch (error) {
    res.json({ result: false, error: error.message });
  }
});

router.post("/upload", async (req, res) => {
  const id = uniqid();
  const photoPath = `../tmp/${id}.jpg`;
  const resultMove = await req.files.photoFromFront.mv(photoPath);

  if (!resultMove) {
    const resultCloudinary = await cloudinary.uploader.upload(
      `./tmp/${id}.jpg`
    );

    fs.unlinkSync(`./tmp/${id}.jpg`);

    console.log(resultCloudinary.secure_url);

    res.json({ result: true, url: resultCloudinary.secure_url });
  } else {
    res.json({ result: false, error: resultMove });
  }
});

router.post("/addProfilPic", (req, res) => {
  User.findOneAndUpdate(
    { token: req.body.token },
    { profilPic: req.body.profilPic }
  ).then((data) => {
    res.json({ result: true, data: data });
  });
});

module.exports = router;
