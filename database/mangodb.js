const { default: mongoose } = require('mongoose');

/**
 * The function `db_connect` attempts to connect to a MongoDB database using Mongoose and logs a
 * success message if the connection is successful.
 */
const dbconnect = () => {
  try {
    mongoose.connect(process.env.MANGODB_URL);
    console.log('Database Connected Successfully');
  } catch (error) {
    console.log('Database error');
  }
};
module.exports = { dbconnect };
