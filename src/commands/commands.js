const fs = require('fs');
const path = require('path');

const commands = [];
const commandFiles = fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.js') && file !== 'commands.js');

for (const file of commandFiles) {
    const command = require(path.join(__dirname, file));
    commands.push(command.data);
}

module.exports = commands.map(command => command.toJSON()); 