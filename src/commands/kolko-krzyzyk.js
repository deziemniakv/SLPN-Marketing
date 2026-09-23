const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

const activePlayers = new Set();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kolko-krzyzyk')
        .setDescription('Zagraj z innym użytkownikiem w Kółko i Krzyżyk.')
        .addUserOption(option =>
            option
                .setName('przeciwnik')
                .setDescription('Użytkownik, którego chcesz wyzwać.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const challenger = interaction.user;
        const opponent = interaction.options.getUser('przeciwnik', true);

        if (opponent.bot) {
            return interaction.reply({
                content: '❌ Nie możesz zagrać z botem.',
                ephemeral: true
            });
        }

        if (opponent.id === challenger.id) {
            return interaction.reply({
                content: '❌ Nie możesz zagrać sam ze sobą.',
                ephemeral: true
            });
        }

        if (activePlayers.has(challenger.id)) {
            return interaction.reply({
                content: '❌ Aktualnie oczekujesz na grę lub już w niej uczestniczysz.',
                ephemeral: true
            });
        }

        if (activePlayers.has(opponent.id)) {
            return interaction.reply({
                content: `❌ ${opponent} aktualnie oczekuje na grę lub już w niej uczestniczy.`,
                ephemeral: true
            });
        }

        activePlayers.add(challenger.id);
        activePlayers.add(opponent.id);

        const gameId = `${interaction.id}-${Date.now()}`;

        const invitationButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tictactoe-accept:${gameId}`)
                .setLabel('Akceptuj')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`tictactoe-decline:${gameId}`)
                .setLabel('Odrzuć')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );

        let message;

        try {
            message = await interaction.reply({
                content:
                    `## 🎮 Kółko i Krzyżyk\n` +
                    `${challenger} wyzywa ${opponent} na pojedynek!\n\n` +
                    `${opponent}, czy akceptujesz zaproszenie?\n` +
                    `⏱️ Masz **60 sekund** na podjęcie decyzji.`,
                components: [invitationButtons],
                fetchReply: true
            });
        } catch (error) {
            activePlayers.delete(challenger.id);
            activePlayers.delete(opponent.id);
            throw error;
        }

        const invitationCollector =
            message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60_000,
                filter: buttonInteraction =>
                    buttonInteraction.customId.endsWith(gameId)
            });

        invitationCollector.on('collect', async buttonInteraction => {
            if (buttonInteraction.user.id === challenger.id) {
                if (
                    buttonInteraction.customId.startsWith(
                        'tictactoe-decline'
                    )
                ) {
                    await buttonInteraction.update({
                        content:
                            `## ❌ Zaproszenie anulowane\n` +
                            `${challenger} anulował zaproszenie do gry.`,
                        components: []
                    });

                    invitationCollector.stop('cancelled');
                    return;
                }

                await buttonInteraction.reply({
                    content: '❌ Nie możesz zaakceptować własnego zaproszenia.',
                    ephemeral: true
                });

                return;
            }

            if (buttonInteraction.user.id !== opponent.id) {
                await buttonInteraction.reply({
                    content: '❌ To zaproszenie nie jest skierowane do Ciebie.',
                    ephemeral: true
                });

                return;
            }

            if (
                buttonInteraction.customId.startsWith('tictactoe-decline')
            ) {
                await buttonInteraction.update({
                    content:
                        `## ❌ Zaproszenie odrzucone\n` +
                        `${opponent} odrzucił zaproszenie od ${challenger}.`,
                    components: []
                });

                invitationCollector.stop('declined');
                return;
            }

            invitationCollector.stop('accepted');

            await startGame({
                buttonInteraction,
                gameId,
                challenger,
                opponent
            });
        });

        invitationCollector.on('end', async (_, reason) => {
            if (reason === 'accepted') return;

            activePlayers.delete(challenger.id);
            activePlayers.delete(opponent.id);

            if (reason === 'time') {
                await interaction.editReply({
                    content:
                        `## ⏱️ Zaproszenie wygasło\n` +
                        `${opponent} nie odpowiedział w wyznaczonym czasie.`,
                    components: []
                }).catch(() => null);
            }
        });
    }
};

async function startGame({
    buttonInteraction,
    gameId,
    challenger,
    opponent
}) {
    const board = Array(9).fill(null);

    let currentPlayer = challenger;
    let gameFinished = false;

    await buttonInteraction.update({
        content: createGameContent({
            challenger,
            opponent,
            currentPlayer
        }),
        components: createBoard(board, gameId)
    });

    const message = buttonInteraction.message;

    const gameCollector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: 120_000,

        filter: interaction =>
            interaction.customId.startsWith(`tictactoe-field:${gameId}:`)
    });

    gameCollector.on('collect', async interaction => {
        if (gameFinished) {
            return interaction.reply({
                content: '❌ Ta gra została już zakończona.',
                ephemeral: true
            });
        }

        if (interaction.user.id !== currentPlayer.id) {
            return interaction.reply({
                content: `⏳ Teraz jest kolej gracza ${currentPlayer}.`,
                ephemeral: true
            });
        }

        const position = Number(
            interaction.customId.split(':').at(-1)
        );

        if (
            Number.isNaN(position) ||
            position < 0 ||
            position > 8 ||
            board[position] !== null
        ) {
            return interaction.reply({
                content: '❌ To pole jest już zajęte.',
                ephemeral: true
            });
        }

        const symbol =
            currentPlayer.id === challenger.id ? 'X' : 'O';

        board[position] = symbol;

        const winnerSymbol = checkWinner(board);

        if (winnerSymbol) {
            gameFinished = true;

            await interaction.update({
                content:
                    `## 🏆 Koniec gry!\n` +
                    `Wygrał ${currentPlayer} grający jako **${winnerSymbol}**!\n\n` +
                    `${challenger}: ❌\n` +
                    `${opponent}: ⭕`,
                components: createBoard(board, gameId, true)
            });

            gameCollector.stop('winner');
            return;
        }

        if (board.every(field => field !== null)) {
            gameFinished = true;

            await interaction.update({
                content:
                    `## 🤝 Remis!\n` +
                    `Wszystkie pola zostały zajęte i nikt nie wygrał.\n\n` +
                    `${challenger}: ❌\n` +
                    `${opponent}: ⭕`,
                components: createBoard(board, gameId, true)
            });

            gameCollector.stop('draw');
            return;
        }

        currentPlayer =
            currentPlayer.id === challenger.id
                ? opponent
                : challenger;

        await interaction.update({
            content: createGameContent({
                challenger,
                opponent,
                currentPlayer
            }),
            components: createBoard(board, gameId)
        });
    });

    gameCollector.on('end', async (_, reason) => {
        activePlayers.delete(challenger.id);
        activePlayers.delete(opponent.id);

        if (reason === 'idle') {
            gameFinished = true;

            await message.edit({
                content:
                    `## ⏱️ Gra zakończona\n` +
                    `Gra została anulowana z powodu braku aktywności.\n\n` +
                    `Ostatnią turę miał ${currentPlayer}.`,
                components: createBoard(board, gameId, true)
            }).catch(() => null);
        }
    });
}

function createGameContent({
    challenger,
    opponent,
    currentPlayer
}) {
    const currentSymbol =
        currentPlayer.id === challenger.id ? 'X' : 'O';

    return (
        `## 🎮 Kółko i Krzyżyk\n` +
        `${challenger}: ❌\n` +
        `${opponent}: ⭕\n\n` +
        `➡️ Teraz rusza się ${currentPlayer} jako **${currentSymbol}**.`
    );
}

function createBoard(board, gameId, disableAll = false) {
    const rows = [];

    for (let row = 0; row < 3; row++) {
        const actionRow = new ActionRowBuilder();

        for (let column = 0; column < 3; column++) {
            const position = row * 3 + column;
            const field = board[position];

            let style = ButtonStyle.Secondary;

            if (field === 'X') {
                style = ButtonStyle.Danger;
            } else if (field === 'O') {
                style = ButtonStyle.Primary;
            }

            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `tictactoe-field:${gameId}:${position}`
                    )
                    .setLabel(field ?? String(position + 1))
                    .setStyle(style)
                    .setDisabled(disableAll || field !== null)
            );
        }

        rows.push(actionRow);
    }

    return rows;
}

function checkWinner(board) {
    const winningCombinations = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],

        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],

        [0, 4, 8],
        [2, 4, 6]
    ];

    for (const [a, b, c] of winningCombinations) {
        if (
            board[a] &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {
            return board[a];
        }
    }

    return null;
}