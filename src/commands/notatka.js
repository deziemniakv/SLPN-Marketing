const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('notatka')
        .setDescription('Wewnętrzne notatki dotyczące pracowników Marketingu (widoczne tylko dla Dyrektora).')
        .addSubcommand(sub =>
            sub
                .setName('dodaj')
                .setDescription('Dodaje notatkę dla pracownika.')
                .addUserOption(option => option.setName('pracownik').setDescription('Pracownik').setRequired(true))
                .addStringOption(option => option.setName('tresc').setDescription('Treść notatki').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('pokaz')
                .setDescription('Wyświetla notatki dotyczące pracownika.')
                .addUserOption(option => option.setName('pracownik').setDescription('Pracownik').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('usun')
                .setDescription('Usuwa notatkę o podanym numerze (z listy /notatka pokaz).')
                .addUserOption(option => option.setName('pracownik').setDescription('Pracownik').setRequired(true))
                .addIntegerOption(option => option.setName('numer').setDescription('Numer notatki z listy').setRequired(true).setMinValue(1))
        ),

    execute: async (interaction) => {
        const { client } = interaction;
        const config = client.config.marketing;

        if (!config || !config.adminRole) {
            return interaction.reply({
                content: '❌ System Marketingu nie jest skonfigurowany (brak "marketing.adminRole" w config.json).',
                ephemeral: true
            });
        }

        if (!interaction.member.roles.cache.has(config.adminRole)) {
            return interaction.reply({ content: '❌ Nie masz uprawnień do zarządzania notatkami.', ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('pracownik');

        if (sub === 'dodaj') {
            const tresc = interaction.options.getString('tresc');
            return client.marketingManager.addNote(interaction, targetUser, tresc);
        }

        if (sub === 'pokaz') {
            return client.marketingManager.listNotes(interaction, targetUser);
        }

        if (sub === 'usun') {
            const numer = interaction.options.getInteger('numer');
            return client.marketingManager.deleteNote(interaction, targetUser, numer);
        }
    }
};
