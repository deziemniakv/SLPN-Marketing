const { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder 
} = require('discord.js');

module.exports = {
    customId: 'ticket_add',
    staffOnly: true,
    async execute(interaction, client) {
        const modal = new ModalBuilder()
            .setCustomId('ticket_add_modal')
            .setTitle('Dodaj użytkownika do ticketu');

        const userInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('ID Użytkownika')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(userInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
    }
}; 