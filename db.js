import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const DB_URI = process.env.DB_URI;
mongoose
  .connect(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const carSchema = new mongoose.Schema({
  carId: String,
  title: String,
  year: String,
  mileage: String,
  price: String,
  credit: String,
  fuel: String,
  engine: String,
  drive: String,
  power: String,
  transmission: String,
  body: String,
  link: String,
});

const adminSchema = new mongoose.Schema({
  adminId: { type: Number, unique: true },
});

const Car = mongoose.model('Car', carSchema);
const Admin = mongoose.model('Admin', adminSchema);

export { Car, Admin };
