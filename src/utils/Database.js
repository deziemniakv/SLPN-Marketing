const mongoose = require('mongoose');

class Database {
    constructor(client) {
        this.client = client;
        this.connected = false;
        this.listenersAttached = false;
    }

    attachListeners() {
        if (this.listenersAttached) return;
        this.listenersAttached = true;

        mongoose.connection.on('connected', () => {
            this.connected = true;
            this.client.handler.logger.log('NORMAL', 'Połączono z bazą danych MongoDB.');
        });

        mongoose.connection.on('disconnected', () => {
            this.connected = false;
            this.client.handler.logger.log('NORMAL', 'Rozłączono z bazą danych MongoDB - system nagrywek wstrzymany do czasu ponownego połączenia.');
        });

        mongoose.connection.on('error', (error) => {
            this.client.handler.logger.log('NORMAL', `Błąd połączenia z MongoDB: ${error.message}`);
        });
    }

    async connect(retryDelayMs = 15000, connectTimeoutMs = 15000) {
        const uri = this.client.config.mongoUri;

        if (!uri) {
            this.client.handler.logger.log(
                'NORMAL',
                'Brak "mongoUri" w config.json - system nagrywek nie będzie działał, dopóki nie skonfigurujesz połączenia z MongoDB.'
            );
            return;
        }

        this.attachListeners();

        try {
            mongoose.set('strictQuery', true);
            await Promise.race([
                mongoose.connect(uri, { serverSelectionTimeoutMS: connectTimeoutMs }),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Przekroczono limit czasu połączenia (${connectTimeoutMs}ms)`)), connectTimeoutMs + 5000);
                })
            ]);

            this.connected = true;
        } catch (error) {
            this.connected = false;
            this.client.handler.logger.log(
                'NORMAL',
                `Nie udało się połączyć z MongoDB (${error.message}). Ponawiam próbę za ${Math.round(retryDelayMs / 1000)}s...`
            );
            setTimeout(() => this.connect(retryDelayMs, connectTimeoutMs), retryDelayMs);
        }
    }
}

module.exports = Database;
