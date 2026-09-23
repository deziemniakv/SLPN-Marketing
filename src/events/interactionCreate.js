const { 
    Modal, 
    TextInputBuilder, 
    TextInputStyle,
    ActionRowBuilder 
} = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            client.handler.logger.log('DEBUG', 
                `Użytkownik ${interaction.user.tag} (${interaction.user.id}) ` +
                `użył komendy /${interaction.commandName} na serwerze ${interaction.guild.name}`
            );

            const command = client.handler.commands.get(interaction.commandName);

            if (!command) {
                console.error(`Nie znaleziono polecenia pasującego do ${interaction.commandName}.`);
                client.handler.logger.log('NORMAL', 
                    `Nieznana komenda ${interaction.commandName} użyta przez ${interaction.user.tag}`
                );
                return;
            }

            try {
                await command.execute(interaction);
                client.handler.logger.log('DEBUG', 
                    `/${interaction.commandName} wykonane przez ${interaction.user.tag}`
                );
            } catch (error) {
                console.error(error);
                client.handler.logger.log('NORMAL', 
                    `Błąd podczas wykonywania polecenia /${interaction.commandName} ` +
                    `przez ${interaction.user.tag} (${interaction.user.id}): ${error.message}`
                );
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ 
                        content: 'Podczas wykonywania tego polecenia wystąpił błąd!', 
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ 
                        content: 'Podczas wykonywania tego polecenia wystąpił błąd!', 
                        ephemeral: true 
                    });
                }
            }
            return;
        }

        if (
            (interaction.isButton() || interaction.isUserSelectMenu() || interaction.isStringSelectMenu())
            && interaction.customId.startsWith('mk_')
        ) {
            try {
                await client.marketingManager.handleComponent(interaction);
            } catch (error) {
                client.handler.logger.log('NORMAL', `Błąd panelu Marketingu (${interaction.customId}): ${error.message}`);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Wystąpił błąd podczas próby wykonania tej akcji!', ephemeral: true });
                }
            }
            return;
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('mk_')) {
            try {
                await client.marketingManager.handleModalSubmit(interaction);
            } catch (error) {
                client.handler.logger.log('NORMAL', `Błąd modala Marketingu (${interaction.customId}): ${error.message}`);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Wystąpił błąd podczas próby wykonania tej akcji!', ephemeral: true });
                }
            }
            return;
        }

        if (interaction.isButton()) {
            const { customId } = interaction;
            let buttonHandler;

            if (customId.startsWith('ticket_create_')) {
                buttonHandler = client.handler.buttons.get('ticket_create');
            } 
            else if (customId.startsWith('log_delete_')) {
                buttonHandler = client.handler.buttons.get('log_delete');
            }
            else if (customId.startsWith('log_info_')) {
                buttonHandler = client.handler.buttons.get('log_info');
            }
            else if (customId.startsWith('nagrywki_join_')) {
                buttonHandler = client.handler.buttons.get('nagrywki_join');
            }
            else if (customId.startsWith('nagrywki_leave_')) {
                buttonHandler = client.handler.buttons.get('nagrywki_leave');
            }
            else if (customId.startsWith('analyst_accept_')) {
                buttonHandler = client.handler.buttons.get('analyst_accept');
            }
            else {
                buttonHandler = client.handler.buttons.get(customId);
            }

            if (!buttonHandler) {
                client.handler.logger.log('NORMAL', `Nieznany przycisk: ${customId}`);
                return;
            }

            if (buttonHandler.staffOnly && !interaction.member.roles.cache.has(client.config.tickets.staffRole)) {
                await interaction.reply({
                    content: 'Nie masz uprawnień do użycia tego przycisku!',
                    ephemeral: true
                });
                return;
            }

            try {
                await buttonHandler.execute(interaction, client);
            } catch (error) {
                client.handler.logger.log('NORMAL', `Error while operating the button ${customId}: ${error.message}`);
                if (!interaction.replied) {
                    await interaction.reply({
                        content: 'Wystąpił błąd podczas próby wykonania tej akcji!',
                        ephemeral: true
                    });
                }
            }
        }

        if (interaction.isModalSubmit()) {
            const { customId } = interaction;

            switch (customId) {
                case 'ticket_rename_modal':
                    const newName = interaction.fields.getTextInputValue('new_name');
                    await interaction.channel.setName(newName);
                    await interaction.reply(`Nazwa ticketu została zmieniona na: ${newName}`);
                    break;

                case 'ticket_add_modal':
                    const userIdToAdd = interaction.fields.getTextInputValue('user_id');
                    try {
                        const user = await interaction.client.users.fetch(userIdToAdd);
                        await interaction.channel.permissionOverwrites.create(user, {
                            ViewChannel: true,
                            SendMessages: true
                        });
                        await interaction.reply(`Użytkownik ${user.tag} został dodany do ticketu.`);
                    } catch (error) {
                        await interaction.reply({
                            content: 'Nie znaleziono użytkownika o podanym ID.',
                            ephemeral: true
                        });
                    }
                    break;

                case 'ticket_remove_modal':
                    const userIdToRemove = interaction.fields.getTextInputValue('user_id');
                    try {
                        const user = await interaction.client.users.fetch(userIdToRemove);
                        await interaction.channel.permissionOverwrites.delete(user.id);
                        await interaction.reply(`Użytkownik ${user.tag} został usunięty z ticketu.`);
                    } catch (error) {
                        await interaction.reply({
                            content: 'Nie znaleziono użytkownika o podanym ID.',
                            ephemeral: true
                        });
                    }
                    break;
            }
        }
    },
}; 