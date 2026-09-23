const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const nagrywkiEventSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    voiceChannelId: { type: String, required: true },
    organizerId: { type: String, required: true },
    time: { type: String, required: true },
    description: { type: String, default: null },
    scheduledAt: { type: Date, required: true },

    status: {
        type: String,
        enum: ['scheduled', 'started', 'finished', 'cancelled'],
        default: 'scheduled'
    },

    participants: { type: [participantSchema], default: [] },
    attendees: { type: [String], default: [] },

    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },

    payrollProcessed: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.models.NagrywkiEvent || mongoose.model('NagrywkiEvent', nagrywkiEventSchema);
