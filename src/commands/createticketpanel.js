const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setName("createticketpanel")
    .setDescription("Creates a panel with buttons for creating tickets"),
  async execute(interaction) {
    if (
      !interaction.member.roles.cache.has(
        interaction.client.config.tickets.adminRole
      )
    ) {
      return interaction.reply({
        content: "Nie masz permisji do użycia tej komendy.",
        ephemeral: true,
      });
    }

    await interaction.client.ticketManager.createTicketPanel(
      interaction.channel
    );
    await interaction.reply({
      content: "Panel ticketa został utworzony!",
      ephemeral: true,
    });
  },
};
