const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Banuje użytkownika z serwera.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Użytkownik do zbanowania')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Powód bana')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    execute: async (interaction) => {
        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || '.';

        if (!target) {
            return await interaction.reply({
                content: 'Użytkownik nie został znaleziony.',
                ephemeral: true
            });
        }

        if (!target.bannable) {
            return await interaction.reply({
                content: 'Nie mogę zbanować tego użytkownika.',
                ephemeral: true
            });
        }

        try {
            await target.ban({ reason });
            await interaction.reply({
                content: `Użytkownik pomyślnie zbanowany ${target.user.tag}\nPowód: ${reason}`
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: 'Wystąpił błąd podczas próby zbanowania użytkownika.',
                ephemeral: true
            });
        }
    }
}; 