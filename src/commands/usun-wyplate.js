const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('usun-wyplate')
        .setDescription('Odejmuje BC od wypłaty pracownika (Dyrektor).')
        .addUserOption(option =>
            option.setName('pracownik').setDescription('Pracownik').setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('ilosc').setDescription('Ile BC odjąć').setRequired(true).setMinValue(1)
        )
        .addStringOption(option =>
            option.setName('powod').setDescription('Powód potrącenia (opcjonalnie)').setRequired(false)
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
            return interaction.reply({ content: '❌ Nie masz uprawnień do korygowania wypłat.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('pracownik');
        const ilosc = interaction.options.getInteger('ilosc');
        const powod = interaction.options.getString('powod');

        await client.marketingManager.recordAdjustment(interaction, targetUser, -ilosc, powod);
    }
};
