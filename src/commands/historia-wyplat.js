const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('historia-wyplat')
        .setDescription('Pokazuje historię wygenerowanych raportów wypłat Marketingu.')
        .addIntegerOption(option =>
            option
                .setName('numer')
                .setDescription('Numer raportu z listy, aby zobaczyć jego szczegóły (opcjonalnie)')
                .setRequired(false)
                .setMinValue(1)
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
            return interaction.reply({
                content: '❌ Nie masz uprawnień do przeglądania historii wypłat.',
                ephemeral: true
            });
        }

        const numer = interaction.options.getInteger('numer');

        await client.marketingManager.showHistory(interaction, numer);
    }
};
