module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        await client.welcomeManager.handleWelcome(member);
    }
}; 