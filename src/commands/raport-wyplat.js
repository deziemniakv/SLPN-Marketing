const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raport-wyplat')
        .setDescription('Generuje raport wypłat Marketingu za dany miesiąc i wysyła go na DM.')
        .addIntegerOption(option =>
            option
                .setName('miesiac_wstecz')
                .setDescription('0 = bieżący miesiąc (domyślnie), 1 = poprzedni miesiąc, itd.')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(6)
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
                content: '❌ Nie masz uprawnień do generowania raportu wypłat.',
                ephemeral: true
            });
        }

        const monthsAgo = interaction.options.getInteger('miesiac_wstecz') ?? 0;

        await client.marketingManager.generateReport(interaction, monthsAgo);
    }
};
