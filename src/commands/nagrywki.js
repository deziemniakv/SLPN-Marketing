const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nagrywki')
        .setDescription('Organizuje nagrywki i tworzy listę zapisów.')
        .addStringOption(option =>
            option
                .setName('godzina')
                .setDescription('Godzina rozpoczęcia w formacie GG:MM, np. 18:00')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option
                .setName('kanal')
                .setDescription('Kanał głosowy, na którym odbędą się nagrywki')
                .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('opis')
                .setDescription('Dodatkowy opis nagrywek (opcjonalnie)')
                .setRequired(false)
        ),

    execute: async (interaction) => {
        const { client } = interaction;
        const config = client.config.nagrywki;

        if (!config || !config.organizerRole) {
            return interaction.reply({
                content: '❌ System nagrywek nie jest skonfigurowany (brak "nagrywki.organizerRole" w config.json).',
                ephemeral: true
            });
        }

        if (!interaction.member.roles.cache.has(config.organizerRole)) {
            return interaction.reply({
                content: '❌ Nie masz uprawnień do organizowania nagrywek.',
                ephemeral: true
            });
        }

        await client.nagrywkiManager.createEvent(interaction);
    }
};
