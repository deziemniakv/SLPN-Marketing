const mongoose = require('mongoose');
const monthlyGoalSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    periodLabel: { type: String, required: true },

    targetNagrywki: { type: Number, default: 0 },
    targetRaporty: { type: Number, default: 0 },
    targetMaterialy: { type: Number, default: 0 },

    aktualneMaterialy: { type: Number, default: 0 },

    setBy: { type: String, required: true }
}, { timestamps: true });

monthlyGoalSchema.index({ guildId: 1, periodLabel: 1 }, { unique: true });

module.exports = mongoose.models.MonthlyGoal || mongoose.model('MonthlyGoal', monthlyGoalSchema);
