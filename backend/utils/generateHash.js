// Small CLI helper: node utils/generateHash.js yourPassword
const bcrypt = require('bcrypt');
const plain = process.argv[2];
if (!plain) {
  console.log('Usage: node utils/generateHash.js <password>');
  process.exit(1);
}
bcrypt.hash(plain, 10).then((hash) => console.log(hash));
