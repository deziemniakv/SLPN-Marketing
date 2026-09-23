const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('statystyki')
        .setDescription('Pokazuje statystyki pracownika Marketingu.')
        .addUserOption(option =>
            option
                .setName('pracownik')
                .setDescription('Pracownik, którego statystyki chcesz zobaczyć (Dyrektor: pomiń, aby wyszukać z listy)')
                .setRequired(false)
        ),

    execute: async (interaction) => {
        const { client } = interaction;
        const config = client.config.marketing;
        const isAdmin = !!(config?.adminRole && interaction.member.roles.cache.has(config.adminRole));

        const explicitTarget = interaction.options.getUser('pracownik');

        if (!isAdmin) {
            const target = explicitTarget || interaction.user;

            if (target.id !== interaction.user.id) {
                return interaction.reply({ content: '❌ Możesz sprawdzić tylko swoje statystyki.', ephemeral: true });
            }

            return client.marketingManager.showStatystyki(interaction, target);
        }

        if (explicitTarget) {
            return client.marketingManager.showStatystyki(interaction, explicitTarget);
        }

        await client.marketingManager.promptStatystykiSearch(interaction);
    }
};
