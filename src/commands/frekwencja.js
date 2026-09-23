const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('frekwencja')
        .setDescription('Sprawdza frekwencję pracownika Marketingu (Dyrektor).')
        .addUserOption(option =>
            option
                .setName('pracownik')
                .setDescription('Pracownik, którego frekwencję chcesz od razu sprawdzić (pomiń, aby wyszukać z listy)')
                .setRequired(false)
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
            return interaction.reply({ content: '❌ Nie masz uprawnień do sprawdzania frekwencji.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('pracownik');

        if (targetUser) {
            return client.marketingManager.showFrekwencja(interaction, targetUser);
        }

        await client.marketingManager.promptFrekwencjaSearch(interaction);
    }
};
