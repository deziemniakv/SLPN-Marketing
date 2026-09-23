const mongoose = require('mongoose');
const analystReportSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true },

    tytul: { type: String, required: true },
    opis: { type: String, required: true },
    muzyka: { type: String, required: true },
    linkInspiracyjny: { type: String, required: true },

    status: {
        type: String,
        enum: ['oczekujacy', 'zaakceptowany'],
        default: 'oczekujacy'
    },
    acceptedBy: { type: String, default: null },
    acceptedAt: { type: Date, default: null },

    // Do edycji embeda po akceptacji.
    messageId: { type: String, default: null },
    channelId: { type: String, default: null }
}, { timestamps: true });

analystReportSchema.index({ guildId: 1, userId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.models.AnalystReport || mongoose.model('AnalystReport', analystReportSchema);
