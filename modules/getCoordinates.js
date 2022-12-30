const fetch = require("node-fetch");
const API_ENDPOINT = "https://api-adresse.data.gouv.fr/search/";

// this function returns the latitude and longitude of a given address
// specified by a street and a city
// return [false, error message] if address cannot be found
async function getCoordinates(street, city) {
  // call a web service to get the gps position of the address
  const address = street ? street + "," + city : city;
  const searchType = street ? "housenumber" : "locality";

  // Format the address into URL
  const encodedAddress = encodeURIComponent(address);

  // call the public API to get the latitude and longitude
  try {
    console.log("url",`${API_ENDPOINT}?q=${encodedAddress}&limit=1&type=${searchType}`)
    let response = await fetch(
      `${API_ENDPOINT}?q=${encodedAddress}&limit=1&type=${searchType}`
    );
    if (response) {
      const data = await response.json();
      //console.log("data.features[0].geometry :", data.features[0].geometry);
      if (data) {
        
        if (data.message){
          // error message is there
          return [false, data.message];
        }
        if (data.features.length) {
          // no error
          const [lon, lat] = data.features[0].geometry.coordinates;
          return [lat, lon];
        } else {
          // city or address not found
          return [false, "not found"];
        }
      }
    }
  } catch (err) {
    console.log("err", err);
    return (false, err.message)
  }
}
module.exports = { getCoordinates };
