const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            const config = require('../config.json');
            return {
                logLevel: config.logLevel || 'NORMAL',
                logging: {
                    console: config.logging?.console ?? true,
                    file: config.logging?.file ?? false,
                    directory: config.logging?.directory || 'logs'
                }
            };
        } catch (error) {
            return {
                logLevel: 'NORMAL',
                logging: {
                    console: true,
                    file: false,
                    directory: 'logs'
                }
            };
        }
    }

    reloadConfig() {
        delete require.cache[require.resolve('../config.json')];
        this.config = this.loadConfig();
    }

    log(level, message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;

        if (level === 'DEBUG' && this.config.logLevel !== 'DEBUG') {
            return;
        }

        if (this.config.logging.console) {
            console.log(logMessage);
        }

        if (this.config.logging.file) {
            try {
                const logDir = path.join(__dirname, '..', this.config.logging.directory);
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true });
                }

                const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`);
                fs.appendFileSync(logFile, logMessage + '\n');
            } catch (error) {
                if (this.config.logging.console) {
                    console.error(`[Logger] Error writing to log file: ${error.message}`);
                }
            }
        }
    }
}

module.exports = Logger; 