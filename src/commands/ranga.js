const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranga')
        .setDescription('Ustawia rangę pracownika Marketingu.')
        .addUserOption(option =>
            option
                .setName('pracownik')
                .setDescription('Pracownik, któremu ustawiasz rangę')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('ranga')
                .setDescription('Nowa ranga pracownika')
                .setRequired(true)
                .addChoices(
                    { name: '🟢 Junior', value: 'junior' },
                    { name: '🔵 Regular', value: 'regular' },
                    { name: '🟣 Senior', value: 'senior' }
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
        const ranga = interaction.options.getString('ranga');

        await client.marketingManager.setRanga(interaction, targetUser, ranga);
    }
};
