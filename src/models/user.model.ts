import { Schema, model, models } from "mongoose";

const userSchema = new Schema({
  email: {
    type: String,
    unique: true,
    required: [true, "Email is required"],
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Invalid email address"]
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    select: false
  },
  firstName: {
    type: String,
    required: [true, "First name is required"]
  },
  lastName: {
    type: String,
    required: [true, "Last name is required"]
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationCode: String,
  verificationTokenExpiry: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

const User = models.User || model("User", userSchema);

export default User; 