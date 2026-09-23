const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lista')
        .setDescription('Pokazuje listę pracowników wg działu i/lub rangi.')
        .addStringOption(option =>
            option
                .setName('dzial')
                .setDescription('Filtruj po dziale')
                .setRequired(false)
                .addChoices(
                    { name: '🎥 Nagrywający', value: 'nagrywajacy' },
                    { name: '📊 Analityk', value: 'analityk' },
                    { name: '🎭 Aktor', value: 'aktor' }
                )
        )
        .addStringOption(option =>
            option
                .setName('ranga')
                .setDescription('Filtruj po randze')
                .setRequired(false)
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
            return interaction.reply({ content: '❌ Nie masz uprawnień do przeglądania listy pracowników.', ephemeral: true });
        }

        const dzial = interaction.options.getString('dzial');
        const ranga = interaction.options.getString('ranga');

        await client.marketingManager.showLista(interaction, dzial, ranga);
    }
};
