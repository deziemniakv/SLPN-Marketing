const mongoose = require('mongoose');
const employeeNoteSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    targetUserId: { type: String, required: true },
    authorId: { type: String, required: true },
    content: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.models.EmployeeNote || mongoose.model('EmployeeNote', employeeNoteSchema);
