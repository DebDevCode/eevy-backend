const moment = require("moment-timezone");

// this function convertsthe input array of string dates into javascript Date objects
//  input strings are supposed to be  in "YYYY-MM-DD HH:mm" format
function getDates(stringDates) {
  console.log("in stringDates");
  console.log("input", stringDates);
  console.log(
    'moment(str, "YYYY-MM-DD HH:mm")',
    moment(stringDates[1], "YYYY-MM-DD HH:mm").toDate()
  );
  return stringDates.map((str) => moment(str, "YYYY-MM-DD HH:mm").toDate());
}

// from an input start Date() and a duration string returns an end Date()
function getEndDate(from, duration) {
  const startMoment = moment(from);
  //   create a duration object
  const d = moment.duration(duration);
  // create the end moment by adding the start moment and the duration
  const endMoment = startMoment.add(d);
  return endMoment.toDate();
}

// format the input Date() object into a string in teh input format
function formatDateToStr(dateObj, formatStr) {
  const dateMoment = moment(dateObj);
  return dateMoment.format(formatStr);
}

// returns a string giving the number of seconds to go until an input upcoming date
function calculateTimeToDate(dateObj) {
  const end = new Date(dateObj).getTime();
  const now = moment();
  const timeToEnd = Math.floor((end - now) / 1000 - 3600);
  return timeToEnd;
}

function calculateAllTimeToDate(dateObjStart, dateObjEnd) {
  const start = dateObjStart.getTime();
  const end = dateObjEnd.getTime();
  const allTime = Math.floor((end - start) / 1000);
  return allTime;
}

module.exports = {
  getDates,
  getEndDate,
  formatDateToStr,
  calculateTimeToDate,
  calculateAllTimeToDate,
};
