const mongoose = require('mongoose');
const nagrywkiStatsSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    joinCount: { type: Number, default: 0 }
}, { timestamps: true });

nagrywkiStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.NagrywkiStats || mongoose.model('NagrywkiStats', nagrywkiStatsSchema);
