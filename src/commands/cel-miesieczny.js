const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cel-miesieczny')
        .setDescription('Cele miesięczne działu Marketingu.')
        .addSubcommand(sub =>
            sub
                .setName('ustaw')
                .setDescription('Ustawia cele na bieżący miesiąc.')
                .addIntegerOption(option => option.setName('nagrywki').setDescription('Cel: liczba nagrywek').setRequired(false).setMinValue(0))
                .addIntegerOption(option => option.setName('raporty').setDescription('Cel: liczba raportów analitycznych').setRequired(false).setMinValue(0))
                .addIntegerOption(option => option.setName('materialy').setDescription('Cel: liczba gotowych materiałów').setRequired(false).setMinValue(0))
        )
        .addSubcommand(sub =>
            sub
                .setName('pokaz')
                .setDescription('Pokazuje cele i postęp na bieżący miesiąc.')
        )
        .addSubcommand(sub =>
            sub
                .setName('aktualizuj-materialy')
                .setDescription('Ręcznie ustawia liczbę materiałów w tym miesiącu (bot tego nie śledzi automatycznie).')
                .addIntegerOption(option => option.setName('liczba').setDescription('Aktualna liczba materiałów').setRequired(true).setMinValue(0))
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
            return interaction.reply({ content: '❌ Nie masz uprawnień do zarządzania celami Marketingu.', ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'ustaw') {
            const nagrywki = interaction.options.getInteger('nagrywki');
            const raporty = interaction.options.getInteger('raporty');
            const materialy = interaction.options.getInteger('materialy');
            return client.marketingManager.setGoal(interaction, { nagrywki, raporty, materialy });
        }

        if (sub === 'pokaz') {
            return client.marketingManager.showGoal(interaction);
        }

        if (sub === 'aktualizuj-materialy') {
            const liczba = interaction.options.getInteger('liczba');
            return client.marketingManager.updateMaterialy(interaction, liczba);
        }
    }
};
