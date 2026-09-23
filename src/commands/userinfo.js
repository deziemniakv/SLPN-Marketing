const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Wyświetla informacje o użytkowniku')
        .addUserOption(option =>
            option.setName('użytkownik')
                .setDescription('Użytkownik, o którym chcesz zobaczyć informacje')
                .setRequired(false)
        ),

    execute: async (interaction) => {
        const targetUser = interaction.options.getUser('użytkownik') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id);

        const roles = member.roles.cache
            .filter(role => role.id !== interaction.guild.id)
            .map(role => role.toString())
            .join(', ') || 'Brak ról';

        const createdTimestamp = Math.floor(targetUser.createdTimestamp / 1000);
        const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);

        const embed = new EmbedBuilder()
            .setColor('#c75ab5')
            .setTitle('Informacje o użytkowniku')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Nazwa użytkownika', value: targetUser.tag, inline: true },
                { name: 'ID', value: targetUser.id, inline: true },
                { name: 'Utworzono konto', value: `<t:${createdTimestamp}:R>`, inline: true },
                { name: 'Dołączył(a) na serwer', value: `<t:${joinedTimestamp}:R>`, inline: true },
                { name: `Role (${member.roles.cache.size - 1})`, value: roles },
                { name: 'Bot', value: targetUser.bot ? 'Tak' : 'Nie', inline: true },
                { name: 'Nick na serwerze', value: member.nickname || 'Brak', inline: true }
            )
            .setFooter({ text: `Wywołano przez ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}; 