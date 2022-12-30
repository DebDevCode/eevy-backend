const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const fileUpload = require("express-fileupload");
const cors = require("cors");

require("dotenv").config();
require("./models/connection");

const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const chargersRouter = require("./routes/chargers");
const reservationsRouter = require("./routes/reservations");

const app = express();

app.use(cors());
app.use(fileUpload());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/chargers", chargersRouter);
app.use("/reservations", reservationsRouter);

module.exports = app;
