const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zakoncz')
        .setDescription('Kończy aktualne nagrywki i wysyła podsumowanie.'),

    execute: async (interaction) => {
        const { client } = interaction;

        if (!client.config.nagrywki || !client.config.nagrywki.adminRole) {
            client.handler.logger.log('DEBUG', 'Uwaga: "nagrywki.adminRole" nie jest ustawione w config.json - /zakoncz zadziała wyłącznie dla organizatora wydarzenia.');
        }

        await client.nagrywkiManager.endEvent(interaction);
    }
};
