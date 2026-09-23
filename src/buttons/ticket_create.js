module.exports = {
    customId: 'ticket_create',
    async execute(interaction, client) {
        const categoryId = interaction.customId.split('_')[2];
        await client.ticketManager.createTicket(interaction, categoryId);
    }
}; 