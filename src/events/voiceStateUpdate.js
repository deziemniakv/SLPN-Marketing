module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        if (!client.nagrywkiManager) return;
        await client.nagrywkiManager.onVoiceStateUpdate(oldState, newState);
    }
};
