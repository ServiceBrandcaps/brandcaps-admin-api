import mongoose from "mongoose";

const DvEventSchema = new mongoose.Schema({
  eventType: { type: String, required: true }, // 'publish','unpublish','sync','error'
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  idDataverse: String,
  dvVariantIds: [String], // ids de variantes DV procesadas
  payload: mongoose.Schema.Types.Mixed, // request body sanitizado
  status: { type: String, enum: ["ok","error"], default: "ok" },
  message: String,
}, { timestamps: true });

export default mongoose.models.DvEvent || mongoose.model("DvEvent", DvEventSchema);
