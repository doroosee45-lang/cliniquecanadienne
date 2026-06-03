const mongoose = require('mongoose');

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log(`MongoDB connecté : ${conn.connection.host}`);
};

module.exports = connectDB;
