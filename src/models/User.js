// src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // por defecto no se devuelve
    },
    role: {
      type: String,
      enum: ["admin", "cliente"],
      default: "cliente",
    },
  },
  { timestamps: true }
);

// Hash en create/save
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Hash en updates tipo findOneAndUpdate
UserSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() || {};

  // admitir password tanto en nivel raíz como dentro de $set
  let pwd = update.password;
  if (!pwd && update.$set) pwd = update.$set.password;

  if (pwd) {
    const hashed = await bcrypt.hash(pwd, 10);
    if (update.$set && "password" in (update.$set || {})) {
      update.$set.password = hashed;
    } else {
      update.password = hashed;
    }
    this.setUpdate(update);
  }
  next();
});

UserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.models.User || mongoose.model("User", UserSchema);
