const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Daje przerwe czasową użytkownikowi na serwerze.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Użytkownik do zmutowania')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('time')
                .setDescription('Czas mutowania w minutach')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Powód mutowania')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    execute: async (interaction) => {
        const target = interaction.options.getMember('user');
        const duration = interaction.options.getInteger('time');
        const reason = interaction.options.getString('reason') || '.';

        if (!target) {
            return await interaction.reply({
                content: 'Użytkownik nie został znaleziony.',
                ephemeral: true
            });
        }

        if (!target.moderatable) {
            return await interaction.reply({
                content: 'Nie mogę zmutować tego użytkownika.',
                ephemeral: true
            });
        }

        try {
            await target.timeout(duration * 60 * 1000, reason);
            await interaction.reply({
                content: `Użytkownik pomyślnie został zmutowany ${target.user.tag} na ${duration} minut\nPowód: ${reason}`
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: 'Wystąpił błąd podczas próby zmutowania użytkownika.',
                ephemeral: true
            });
        }
    }
}; 