const mongoose = require('mongoose');

const pubReportageSchema = new mongoose.Schema(
  {
    titre: { type: String, required: true, trim: true },
    description: { type: String },
    type: {
      type: String,
      enum: ['publicite', 'reportage'],
      default: 'reportage',
    },
    village: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Village',
      default: null,
    },
    videoUrl: { type: String, required: true },
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SuperAdmin',
      required: true,
    },
    likes: { type: Number, default: 0 },
    vues: { type: Number, default: 0 },
  },
  { timestamps: true }
);

pubReportageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PubReportage', pubReportageSchema);
