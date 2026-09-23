const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Sprawdza opóźnienie bota oraz połączenia z API Discorda.'),
        
    execute: async (interaction) => {
        try {
            await interaction.deferReply();

            const apiLatency = Math.round(Date.now() - interaction.createdTimestamp);
            const wsPing = Math.round(interaction.client.ws.ping);
            const color = apiLatency > 500 || wsPing > 500 ? 'Red' 
                        : apiLatency > 200 || wsPing > 200 ? 'Yellow' 
                        : 'Green';
            const embed = new EmbedBuilder()
                .setTitle('🏓 Pong!')
                .addFields(
                    { name: '⏱️ > Opóźnienie odpowiedzi (API)', value: `\`${apiLatency}ms\``, inline: true },
                    { name: '🌐 > Opóźnienie WebSocket', value: `\`${wsPing}ms\``, inline: true }
                )
                .setColor(color)
                .setFooter({ 
                    text: `Żądanie wykonane przez ${interaction.user.tag}`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Błąd komendy /ping:', error);
            const errorMsg = interaction.deferred || interaction.replied 
                ? '❌ Wystąpił błąd podczas generowania odpowiedzi.' 
                : '❌ Wystąpił błąd podczas wykonywania komendy.';
                
            await interaction.followUp({ content: errorMsg, ephemeral: true });
        }
    }
};