const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dzial')
        .setDescription('Ustawia dział pracownika Marketingu.')
        .addUserOption(option =>
            option
                .setName('pracownik')
                .setDescription('Pracownik, któremu ustawiasz dział')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('dzial')
                .setDescription('Nowy dział pracownika')
                .setRequired(true)
                .addChoices(
                    { name: '🎥 Nagrywający', value: 'nagrywajacy' },
                    { name: '📊 Analityk', value: 'analityk' },
                    { name: '🎭 Aktor', value: 'aktor' }
                )
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
                content: '❌ Nie masz uprawnień do zarządzania pracownikami Marketingu.',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('pracownik');
        const dzial = interaction.options.getString('dzial');

        await client.marketingManager.setDzial(interaction, targetUser, dzial);
    }
};
