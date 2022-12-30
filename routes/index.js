var express = require('express');
var router = express.Router();
const {getCoordinates}= require('../modules/getCoordinates');
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/cityCoord/:cityName', async (req,res)=>{
  const [latitude,longitude ] = await getCoordinates(null,req.params.cityName)
  if (latitude){ 
    res.json({ result:true, latitude, longitude });

  } else {
    // if latitude = false is returned, longitude contains the error message
    res.json({ result:false, error:longitude });
  }
  
});

module.exports = router;
