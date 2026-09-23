const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const Logger = require('../utils/Logger');

class Handler {
    constructor(client) {
        this.client = client;
        this.commands = new Collection();
        this.components = new Collection();
        this.buttons = new Collection();
        this.logger = new Logger();
        this.slashCommands = [];
    }

    async loadCommands() {
        const commandsPath = path.join(__dirname, '..', 'commands');
        const commandFiles = this.getFiles(commandsPath, '.js');

        for (const file of commandFiles) {
            try {
                const command = require(file);
                const commandName = path.basename(file).split('.')[0];
                
                this.commands.set(commandName, command);
                
                if (command.data) {
                    this.slashCommands.push(command.data.toJSON());
                }
                
                this.logger.log('NORMAL', `Loaded command: ${commandName}`);
            } catch (error) {
                this.logger.log('NORMAL', `Error loading command from ${file}: ${error.message}`);
            }
        }

        await this.registerSlashCommands();
    }

    async registerSlashCommands() {
        try {
            this.logger.log('NORMAL', 'Started refreshing application (/) commands.');

            const { REST, Routes } = require('discord.js');
            const rest = new REST().setToken(this.client.token);

            await rest.put(
                Routes.applicationCommands(this.client.user.id),
                { body: this.slashCommands },
            );

            this.logger.log('NORMAL', 'Successfully reloaded application (/) commands.');
        } catch (error) {
            this.logger.log('NORMAL', `Error registering slash commands: ${error.message}`);
        }
    }

    async loadEvents() {
        const eventsPath = path.join(__dirname, '..', 'events');
        const eventFiles = this.getFiles(eventsPath, '.js');

        for (const file of eventFiles) {
            try {
                const event = require(file);
                const eventName = path.basename(file).split('.')[0];

                if (event.once) {
                    this.client.once(eventName, (...args) => event.execute(...args, this.client));
                } else {
                    this.client.on(eventName, (...args) => event.execute(...args, this.client));
                }
                
                this.logger.log('NORMAL', `Loaded event: ${eventName}`);
            } catch (error) {
                this.logger.log('NORMAL', `Error loading event from ${file}: ${error.message}`);
            }
        }
    }

    async loadComponents() {
        const componentsPath = path.join(__dirname, '..', 'components');
        const componentFiles = this.getFiles(componentsPath, '.js');

        for (const file of componentFiles) {
            try {
                const component = require(file);
                const componentName = path.basename(file).split('.')[0];
                
                this.components.set(componentName, component);
                this.logger.log('NORMAL', `Loaded component: ${componentName}`);
            } catch (error) {
                this.logger.log('NORMAL', `Error loading component from ${file}: ${error.message}`);
            }
        }
    }

    async loadButtons() {
        const buttonsPath = path.join(__dirname, '..', 'buttons');
        const buttonFiles = this.getFiles(buttonsPath, '.js');

        for (const file of buttonFiles) {
            try {
                const button = require(file);
                const buttonName = path.basename(file).split('.')[0];
                
                this.buttons.set(button.customId, button);
                this.logger.log('NORMAL', `Loaded button: ${buttonName}`);
            } catch (error) {
                this.logger.log('NORMAL', `Error loading button from ${file}: ${error.message}`);
            }
        }
    }

    getFiles(directory, extension) {
        if (!fs.existsSync(directory)) return [];
        
        return fs.readdirSync(directory)
            .filter(file => file.endsWith(extension))
            .map(file => path.join(directory, file));
    }
}

module.exports = Handler; 