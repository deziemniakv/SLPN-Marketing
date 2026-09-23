require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const Handler = require('./handlers/Handler');
const config = require('./config.json');
const TicketManager = require('./modules/TicketManager');
const WelcomeManager = require('./modules/WelcomeManager');
const NagrywkiManager = require('./modules/NagrywkiManager');
const MarketingManager = require('./modules/MarketingManager');
const Database = require('./utils/Database');

config.token = process.env.DISCORD_TOKEN;
config.mongoUri = process.env.MONGO_URI;

if (!config.token) {
    console.error('Brak DISCORD_TOKEN w pliku .env - uzupelnij go (patrz .env.example) i uruchom bota ponownie.');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping
    ],
    partials: ['CHANNEL', 'MESSAGE', 'REACTION']
});

client.config = config;

client.handler = new Handler(client);
client.ticketManager = new TicketManager(client);
client.welcomeManager = new WelcomeManager(client);
client.nagrywkiManager = new NagrywkiManager(client);
client.marketingManager = new MarketingManager(client);
client.database = new Database(client);

async function initialize() {
    try {
        await client.login(config.token);

        await new Promise(resolve => {
            if (client.isReady()) resolve();
            else client.once('ready', resolve);
        });

        client.handler.logger.log('NORMAL', 'Synchronizacja cache kanałów...');
        const guilds = await client.guilds.fetch();
        for (const [guildId] of guilds) {
            const guild = await client.guilds.fetch(guildId);
            await guild.channels.fetch();
            client.handler.logger.log('DEBUG', `Zsynchronizowano kanały dla serwera: ${guild.name}`);
        }
        
        await client.handler.loadCommands();
        await client.handler.loadEvents();
        await client.handler.loadComponents();
        await client.handler.loadButtons();

        await client.database.connect();
        client.nagrywkiManager.init();
        client.marketingManager.init();

        client.handler.logger.log('NORMAL', 'Bot został pomyślnie zainicjalizowany!');
    } catch (error) {
        client.handler.logger.log('NORMAL', `Initialization error: ${error.message}`);
        process.exit(1);
    }
}

initialize();

process.on('unhandledRejection', error => {
    client.handler.logger.log('NORMAL', `Unhandled rejection: ${error.message}`);
});

process.on('uncaughtException', error => {
    client.handler.logger.log('NORMAL', `Uncaught exception: ${error.message}`);
}); 

const dns = require("dns");

dns.setServers([
    "1.1.1.1",
    "8.8.8.8"
]);