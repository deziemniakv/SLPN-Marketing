const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ogloszenie')
        .setDescription('Wysyła ogłoszenie Marketingu na wybrany kanał.')
        .addChannelOption(option =>
            option
                .setName('kanal')
                .setDescription('Kanał, na który ma zostać wysłane ogłoszenie')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('tresc')
                .setDescription('Treść ogłoszenia')
                .setRequired(true)
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
            return interaction.reply({ content: '❌ Nie masz uprawnień do publikowania ogłoszeń Marketingu.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('kanal');
        const tresc = interaction.options.getString('tresc');

        await client.marketingManager.sendAnnouncement(interaction, channel, tresc);
    }
};
