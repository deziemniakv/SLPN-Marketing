const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('Resetuje rangę, dział i wypłatę pracownika (Dyrektor).')
        .addUserOption(option =>
            option.setName('pracownik').setDescription('Pracownik do zresetowania').setRequired(true)
        ),

    execute: async (interaction) => {
        const { client } = interaction;
        const config = client.config.marketing;

        if (!config || !config.adminRole) {
            return interaction.reply({
                content: '❌ System Marketingu nie jest skonfigurowany (brak "marketing.adminRole" w config.json).',
                ephemeral: true
            });
        }

        if (!interaction.member.roles.cache.has(config.adminRole)) {
            return interaction.reply({ content: '❌ Nie masz uprawnień do resetowania pracowników.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('pracownik');
        await client.marketingManager.resetEmployee(interaction, targetUser);
    }
};
