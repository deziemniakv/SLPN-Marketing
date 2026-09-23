const mongoose = require('mongoose');
const marketingEmployeeSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    dzial: {
        type: String,
        enum: ['nagrywajacy', 'analityk', 'aktor'],
        default: null
    },
    ranga: {
        type: String,
        enum: ['junior', 'regular', 'senior'],
        default: null
    }
}, { timestamps: true });

marketingEmployeeSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.MarketingEmployee || mongoose.model('MarketingEmployee', marketingEmployeeSchema);
