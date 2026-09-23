module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`Zalogowano na ${client.user.tag}!`);
    }
}; 