module.exports = {
    customId: 'nagrywki_join',
    async execute(interaction, client) {
        const eventId = interaction.customId.split('_')[2];
        await client.nagrywkiManager.toggleParticipant(interaction, eventId, 'join');
    }
};
