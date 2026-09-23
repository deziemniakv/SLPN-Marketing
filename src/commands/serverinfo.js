const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Wyświetla informacje o serwerze.'),

    execute: async (interaction) => {
        const guild = interaction.guild;
        const owner = await guild.fetchOwner();
        
        const channels = guild.channels.cache;
        const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
        const categoryChannels = channels.filter(c => c.type === ChannelType.GuildCategory).size;

        const members = guild.members.cache;
        const totalMembers = members.size;
        const humans = members.filter(member => !member.user.bot).size;
        const bots = members.filter(member => member.user.bot).size;

        const roles = guild.roles.cache.size - 1;

        const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

        const embed = new EmbedBuilder()
            .setColor('#c75ab5')
            .setTitle('Informacje o serwerze')
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: 'Nazwa serwera', value: guild.name, inline: true },
                { name: 'ID serwera', value: guild.id, inline: true },
                { name: 'Właściciel', value: `${owner.user.tag}`, inline: true },
                { name: 'Data utworzenia', value: `<t:${createdTimestamp}:R>`, inline: true },
                { name: 'Region', value: guild.preferredLocale, inline: true },
                { name: 'Poziom boostu', value: `${guild.premiumTier}`, inline: true },
                { name: 'Liczba boostów', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
                { name: 'Członkowie', value: `Wszyscy: ${totalMembers}\nLudzie: ${humans}\nBoty: ${bots}`, inline: true },
                { name: 'Kanały', value: `Kanał tekstowy: ${textChannels}\nKanał głosowy: ${voiceChannels}\nKategoria: ${categoryChannels}`, inline: true },
                { name: `Role (${roles})`, value: roles > 0 ? `${roles} role` : 'no roles' }
            )
            .setFooter({ text: `Użył: ${interaction.user.tag}` })
            .setTimestamp();

        if (guild.banner) {
            embed.setImage(guild.bannerURL({ dynamic: true }));
        }

        await interaction.reply({ embeds: [embed] });
    }
}; 