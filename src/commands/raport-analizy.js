const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raport-analizy')
        .setDescription('Zgłasza pomysł na materiał do akceptacji Dyrektora (dla działu Analityk).')
        .addStringOption(option =>
            option.setName('tytul').setDescription('Tytuł filmu').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('opis').setDescription('Opis filmu').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('muzyka').setDescription('Muzyka filmu').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('link_inspiracyjny').setDescription('Link inspiracyjny (np. do TikToka)').setRequired(true)
        ),

    execute: async (interaction) => {
        const tytul = interaction.options.getString('tytul');
        const opis = interaction.options.getString('opis');
        const muzyka = interaction.options.getString('muzyka');
        const linkInspiracyjny = interaction.options.getString('link_inspiracyjny');

        await interaction.client.marketingManager.submitAnalystReport(interaction, { tytul, opis, muzyka, linkInspiracyjny });
    }
};
