const mongoose = require('mongoose');
const marketingAdjustmentSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    periodLabel: { type: String, required: true },

    amount: { type: Number, required: true },
    reason: { type: String, default: null },

    createdBy: { type: String, required: true }
}, { timestamps: true });

marketingAdjustmentSchema.index({ guildId: 1, userId: 1, periodLabel: 1 });

module.exports = mongoose.models.MarketingAdjustment || mongoose.model('MarketingAdjustment', marketingAdjustmentSchema);
