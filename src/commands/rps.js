const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

const WEAPONS = {
    kamien: { name: 'Kamień', emoji: '🪨', beats: 'nozyce' },
    papier: { name: 'Papier', emoji: '📄', beats: 'kamien' },
    nozyce: { name: 'Nożyce', emoji: '✂️', beats: 'papier' }
};

function resolveGame(choice1, choice2) {
    if (choice1 === choice2) return 'tie';
    if (WEAPONS[choice1].beats === choice2) return 'win1';
    return 'win2';
}

function createWeaponButtons(gameId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${gameId}:kamien`).setEmoji('🪨').setLabel('Kamień').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
        new ButtonBuilder().setCustomId(`${gameId}:papier`).setEmoji('📄').setLabel('Papier').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
        new ButtonBuilder().setCustomId(`${gameId}:nozyce`).setEmoji('✂️').setLabel('Nożyce').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Zagraj w Kamień, Papier, Nożyce!')
        .addUserOption(option =>
            option.setName('przeciwnik')
                .setDescription('Oznacz gracza (PvP) lub pozostaw puste, aby zagrać z botem (PvE).')
                .setRequired(false)
        ),

    async execute(interaction) {
        const challenger = interaction.user;
        const opponent = interaction.options.getUser('przeciwnik');
        const gameId = interaction.id;

        if (!opponent || opponent.id === interaction.client.user.id) {
            const embed = new EmbedBuilder()
                .setTitle('🤖 PKN: Ty vs Bot')
                .setDescription(`**${challenger.username}**, wybierz swoją broń!`)
                .setColor('#3498db');

            const message = await interaction.reply({
                embeds: [embed],
                components: [createWeaponButtons(gameId)],
                fetchReply: true
            });

            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 30_000,
                filter: i => i.user.id === challenger.id
            });

            collector.on('collect', async i => {
                const playerChoice = i.customId.split(':')[1];
                const botChoices = Object.keys(WEAPONS);
                const botChoice = botChoices[Math.floor(Math.random() * botChoices.length)];
                
                const result = resolveGame(playerChoice, botChoice);

                let resultText = '';
                let color = '#f1c40f';

                if (result === 'win1') {
                    resultText = `🎉 **Wygrywasz!** ${WEAPONS[playerChoice].emoji} pokonuje ${WEAPONS[botChoice].emoji}.`;
                    color = '#2ecc71';
                } else if (result === 'win2') {
                    resultText = `💀 **Przegrywasz!** ${WEAPONS[botChoice].emoji} pokonuje ${WEAPONS[playerChoice].emoji}.`;
                    color = '#e74c3c';
                } else {
                    resultText = `🤝 **Remis!** Oboje wybraliście ${WEAPONS[playerChoice].emoji}.`;
                }

                const resultEmbed = new EmbedBuilder()
                    .setTitle('🤖 KPN: Wynik')
                    .setDescription(
                        `**Twój wybór:** ${WEAPONS[playerChoice].emoji} ${WEAPONS[playerChoice].name}\n` +
                        `**Wybór Bota:** ${WEAPONS[botChoice].emoji} ${WEAPONS[botChoice].name}\n\n` +
                        resultText
                    )
                    .setColor(color);

                await i.update({ embeds: [resultEmbed], components: [createWeaponButtons(gameId, true)] });
                collector.stop();
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await interaction.editReply({
                        content: '⏱️ Czas na wybór minął!',
                        components: [createWeaponButtons(gameId, true)]
                    }).catch(() => {});
                }
            });
            return;
        }

        if (opponent.bot) {
            return interaction.reply({ content: '❌ Nie możesz grać z botami w trybie PvP. Użyj komendy bez oznaczania nikogo.', ephemeral: true });
        }
        if (opponent.id === challenger.id) {
            return interaction.reply({ content: '❌ Nie możesz grać sam ze sobą!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('⚔️ PKN: Pojedynek Graczy')
            .setDescription(
                `**${challenger.username}** wyzywa **${opponent.username}**!\n\n` +
                `Kliknijcie przyciski poniżej, aby dokonać **tajnego wyboru**.\n` +
                `⏱️ Macie **60 sekund**.`
            )
            .setColor('#9b59b6');

        const message = await interaction.reply({
            embeds: [embed],
            components: [createWeaponButtons(gameId)],
            fetchReply: true
        });

        const choices = { [challenger.id]: null, [opponent.id]: null };

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60_000
        });

        collector.on('collect', async i => {
            if (i.user.id !== challenger.id && i.user.id !== opponent.id) {
                return i.reply({ content: '❌ To nie jest Twoja gra!', ephemeral: true });
            }

            if (choices[i.user.id]) {
                return i.reply({ content: '❌ Już dokonałeś wyboru! Czekaj na przeciwnika.', ephemeral: true });
            }

            const choice = i.customId.split(':')[1];
            choices[i.user.id] = choice;

            await i.reply({ 
                content: `✅ Tajnie wybrałeś: ${WEAPONS[choice].emoji} **${WEAPONS[choice].name}**`, 
                ephemeral: true 
            });

            if (choices[challenger.id] && choices[opponent.id]) {
                collector.stop('completed');
            }
        });

        collector.on('end', async (collected, reason) => {
            const p1Choice = choices[challenger.id];
            const p2Choice = choices[opponent.id];

            if (reason === 'time') {
                let failMsg = '⏱️ Czas minął! ';
                if (!p1Choice && !p2Choice) failMsg += 'Żaden z graczy nie wybrał broni.';
                else if (!p1Choice) failMsg += `${challenger.username} nie wybrał broni. ${opponent.username} wygrywa walkowerem!`;
                else failMsg += `${opponent.username} nie wybrał broni. ${challenger.username} wygrywa walkowerem!`;

                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⚔️ PKN: Koniec czasu')
                    .setDescription(failMsg)
                    .setColor('#e74c3c');

                return message.edit({ embeds: [timeoutEmbed], components: [createWeaponButtons(gameId, true)] }).catch(() => {});
            }

            const result = resolveGame(p1Choice, p2Choice);
            let resultText = '';
            let color = '#f1c40f';

            if (result === 'win1') {
                resultText = `🏆 **Wygrywa ${challenger.username}!**`;
                color = '#2ecc71';
            } else if (result === 'win2') {
                resultText = `🏆 **Wygrywa ${opponent.username}!**`;
                color = '#2ecc71';
            } else {
                resultText = `🤝 **Remis!**`;
            }

            const resultEmbed = new EmbedBuilder()
                .setTitle('⚔️ PKN: Wynik Pojedynku')
                .setDescription(
                    `${challenger.username}: ${WEAPONS[p1Choice].emoji} **${WEAPONS[p1Choice].name}**\n` +
                    `${opponent.username}: ${WEAPONS[p2Choice].emoji} **${WEAPONS[p2Choice].name}**\n\n` +
                    `${resultText}`
                )
                .setColor(color);

            await message.edit({ embeds: [resultEmbed], components: [createWeaponButtons(gameId, true)] }).catch(() => {});
        });
    }
};