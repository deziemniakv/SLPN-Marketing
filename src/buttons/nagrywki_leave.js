module.exports = {
    customId: 'nagrywki_leave',
    async execute(interaction, client) {
        const eventId = interaction.customId.split('_')[2];
        await client.nagrywkiManager.toggleParticipant(interaction, eventId, 'leave');
    }
};
