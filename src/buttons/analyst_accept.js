module.exports = {
    customId: 'analyst_accept',
    async execute(interaction, client) {
        const reportId = interaction.customId.split('_')[2];
        await client.marketingManager.acceptAnalystReport(interaction, reportId);
    }
};
