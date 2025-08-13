import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['cliente', 'admin'],   // <-- Se incluye 'cliente' aquí
    default: 'cliente'
  }
}, { timestamps: true })

export default mongoose.models.User || mongoose.model('User', UserSchema)
