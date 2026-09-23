const mongoose = require('mongoose');
const marketingReminderSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    periodLabel: { type: String, required: true },
    daysRemaining: { type: Number, required: true }
}, { timestamps: true });

marketingReminderSchema.index({ guildId: 1, periodLabel: 1, daysRemaining: 1 }, { unique: true });

module.exports = mongoose.models.MarketingReminder || mongoose.model('MarketingReminder', marketingReminderSchema);
