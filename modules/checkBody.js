function checkBody(body, keys) {
  let isValid = true;

  for (const field of keys) {
    console.log ( field, body[field], typeof body[field]);
    if (typeof body[field]!== 'boolean' && (!body[field] || body[field] === '')) {
      console.log("missing field", field)
      isValid = false;
      break
    }
  }

  return isValid;
}

module.exports = { checkBody };
