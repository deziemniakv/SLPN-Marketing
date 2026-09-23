const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('statystyki-nagrywki')
        .setDescription('Pokazuje ranking obecności na nagrywkach (liczba faktycznych wejść na kanał).'),

    execute: async (interaction) => {
        await interaction.client.nagrywkiManager.showStats(interaction);
    }
};
