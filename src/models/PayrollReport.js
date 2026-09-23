const mongoose = require('mongoose');

const payrollEntrySchema = new mongoose.Schema({
    userId: { type: String, required: true },
    dzial: { type: String, required: true },
    ranga: { type: String, required: true },
    activityCount: { type: Number, required: true },
    adjustment: { type: Number, default: 0 },
    payout: { type: Number, required: true }
}, { _id: false });

const payrollReportSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    generatedBy: { type: String, required: true },

    periodLabel: { type: String, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    entries: { type: [payrollEntrySchema], default: [] },
    unassignedUserIds: { type: [String], default: [] },

    totalAmount: { type: Number, required: true },
    employeeCount: { type: Number, required: true }
}, { timestamps: true });

payrollReportSchema.index({ guildId: 1, periodLabel: 1 }, { unique: true });

module.exports = mongoose.models.PayrollReport || mongoose.model('PayrollReport', payrollReportSchema);
