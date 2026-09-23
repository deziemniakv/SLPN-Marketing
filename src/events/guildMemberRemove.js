module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        await client.welcomeManager.handleLeave(member);
    }
}; 