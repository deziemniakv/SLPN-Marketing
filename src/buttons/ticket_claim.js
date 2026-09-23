const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    customId: 'ticket_claim',
    staffOnly: true,
    async execute(interaction, client) {
        try {
            const channel = interaction.channel;

            if (!channel.topic || !channel.parentId) {
                await interaction.reply({
                    content: 'Ten kanał nie jest Ticketem!',
                    ephemeral: true
                });
                return;
            }

            const topicParts = channel.topic.split('|');
            const claimedPart = topicParts.find(part => part.startsWith('claimed:'));

            if (claimedPart) {
                const claimedById = claimedPart.split(':')[1];

                if (claimedById === interaction.user.id) {
                    await interaction.reply({
                        content: 'ℹ️ Już przejąłeś/aś ten ticket.',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `❌ Ten ticket został już przejęty przez <@${claimedById}>.`,
                        ephemeral: true
                    });
                }
                return;
            }

            const creatorId = topicParts[0];
            await channel.setTopic(`${creatorId}|creator|claimed:${interaction.user.id}`);

            const originalMessage = interaction.message;
            const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
                .addFields({ name: 'Przejęty przez', value: `<@${interaction.user.id}>` });

            const updatedComponents = originalMessage.components.map(row => {
                const newRow = new ActionRowBuilder();
                row.components.forEach(component => {
                    const button = ButtonBuilder.from(component);
                    if (component.customId === 'ticket_claim') {
                        button.setLabel('Przejęty').setDisabled(true).setStyle(ButtonStyle.Secondary);
                    }
                    newRow.addComponents(button);
                });
                return newRow;
            });

            await originalMessage.edit({
                embeds: [updatedEmbed],
                components: updatedComponents
            });

            await interaction.reply({
                content: `🖐️ Ticket został przejęty przez ${interaction.user}! Od teraz tylko ta osoba może go zamknąć.`
            });

            try {
                await client.ticketManager.logTicketAction(interaction.guild, {
                    action: 'claim',
                    user: interaction.user,
                    ticketId: channel.id
                });
            } catch (error) {
                client.handler.logger.log('NORMAL', `Error logging ticket claim: ${error.message}`);
            }
        } catch (error) {
            console.error(error);
            client.handler.logger.log('NORMAL', `Error in ticket_claim button: ${error.message}`);
            if (!interaction.replied) {
                await interaction.reply({
                    content: 'Wystąpił błąd podczas przejmowania ticketu!',
                    ephemeral: true
                });
            }
        }
    }
};
