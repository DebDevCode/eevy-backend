const mongoose = require('mongoose');
// one field for now: in principle refereferd by several account movements
const accountSchema =mongoose.Schema({
    balance:Number,
})


const Account = mongoose.model('accounts', accountSchema);
module.exports = Account;