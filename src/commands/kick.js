const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Wyrzuca użytkownika z serwera')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Użytkownik do wyrzucenia')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Powód wyrzucenia z serwera')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    execute: async (interaction) => {
        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || '.';

        if (!target) {
            return await interaction.reply({
                content: 'Użytkownik nie został znaleziony.',
                ephemeral: true
            });
        }

        if (!target.kickable) {
            return await interaction.reply({
                content: 'Nie mogę wyrzucić tego użytkownika.',
                ephemeral: true
            });
        }

        try {
            await target.kick(reason);
            await interaction.reply({
                content: `Użytkownik pomyślnie został wyrzucony ${target.user.tag}\nPowód: ${reason}`
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: 'Wystąpił błąd podczas próby wyrzucenia użytkownika.',
                ephemeral: true
            });
        }
    }
}; 