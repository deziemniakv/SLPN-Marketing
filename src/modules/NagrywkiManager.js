const {
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');
const NagrywkiEvent = require('../models/NagrywkiEvent');
const NagrywkiStats = require('../models/NagrywkiStats');

let voice = null;
try {
    voice = require('@discordjs/voice');
} catch (error) {
    voice = null;
}

class NagrywkiManager {
    constructor(client) {
        this.client = client;
        this.config = client.config.nagrywki || {};
        this.checkTimer = null;
    }

    init() {
        if (!voice) {
            this.client.handler.logger.log(
                'NORMAL',
                'Pakiet @discordjs/voice nie jest zainstalowany - bot NIE będzie automatycznie dołączał na kanał głosowy nagrywek. ' +
                'Zainstaluj: npm install @discordjs/voice libsodium-wrappers'
            );
        }

        const intervalMs = this.config.checkIntervalMs || 30000;

        this.checkTimer = setInterval(() => {
            this.checkScheduledEvents().catch(error => {
                this.client.handler.logger.log('NORMAL', `Błąd sprawdzania zaplanowanych nagrywek: ${error.message}`);
            });
        }, intervalMs);

        this.client.handler.logger.log('NORMAL', 'Moduł nagrywek został uruchomiony.');
    }

    async createEvent(interaction) {
        const { client } = this;

        try {
            const timeStr = interaction.options.getString('godzina');
            const voiceChannel = interaction.options.getChannel('kanal');
            const description = interaction.options.getString('opis');

            const parsedTime = this.parseTime(timeStr);
            if (!parsedTime) {
                return interaction.reply({
                    content: '❌ Niepoprawny format godziny. Użyj formatu GG:MM, np. `18:00`.',
                    ephemeral: true
                });
            }

            if (
                voiceChannel.type !== ChannelType.GuildVoice &&
                voiceChannel.type !== ChannelType.GuildStageVoice
            ) {
                return interaction.reply({
                    content: '❌ Wybrany kanał musi być kanałem głosowym.',
                    ephemeral: true
                });
            }

            const scheduledAt = this.computeScheduledDate(parsedTime.hour, parsedTime.minute);

            client.handler.logger.log(
                'DEBUG',
                `Zaplanowano nagrywki na ${timeStr} czasu ${this.getTimezone()} ` +
                `→ UTC: ${scheduledAt.toISOString()} ` +
                `(zegar serwera teraz: ${new Date().toISOString()}, strefa hosta: ${Intl.DateTimeFormat().resolvedOptions().timeZone}).`
            );

            const eventDoc = await NagrywkiEvent.create({
                guildId: interaction.guild.id,
                channelId: interaction.channel.id,
                voiceChannelId: voiceChannel.id,
                organizerId: interaction.user.id,
                time: timeStr,
                description: description || null,
                scheduledAt,
                status: 'scheduled'
            });

            const embed = this.buildSignupEmbed(eventDoc);
            const row = this.buildSignupButtons(eventDoc._id.toString());

            const message = await interaction.channel.send({ embeds: [embed], components: [row] });

            eventDoc.messageId = message.id;
            await eventDoc.save();

            await interaction.reply({
                content: `✅ Nagrywki na godzinę **${timeStr}** zostały zaplanowane!`,
                ephemeral: true
            });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas tworzenia wydarzenia nagrywek: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Wystąpił błąd podczas tworzenia wydarzenia nagrywek.',
                    ephemeral: true
                });
            }
        }
    }

    async toggleParticipant(interaction, eventId, action) {
        const { client } = this;

        try {
            const eventDoc = await NagrywkiEvent.findById(eventId);

            if (!eventDoc) {
                return interaction.reply({ content: '❌ To wydarzenie już nie istnieje.', ephemeral: true });
            }

            if (eventDoc.status === 'finished' || eventDoc.status === 'cancelled') {
                return interaction.reply({ content: '❌ To wydarzenie zostało już zakończone.', ephemeral: true });
            }

            const alreadyJoined = eventDoc.participants.some(p => p.userId === interaction.user.id);

            if (action === 'join') {
                if (alreadyJoined) {
                    return interaction.reply({ content: 'ℹ️ Jesteś już zapisany/a na te nagrywki!', ephemeral: true });
                }

                eventDoc.participants.push({ userId: interaction.user.id });
                await eventDoc.save();
                await interaction.reply({ content: '✅ Zapisano Cię na nagrywki!', ephemeral: true });
            } else {
                if (!alreadyJoined) {
                    return interaction.reply({ content: 'ℹ️ Nie jesteś zapisany/a na te nagrywki.', ephemeral: true });
                }

                eventDoc.participants = eventDoc.participants.filter(p => p.userId !== interaction.user.id);
                await eventDoc.save();
                await interaction.reply({ content: '✅ Anulowano Twój udział w nagrywkach.', ephemeral: true });
            }

            const updatedEmbed = this.buildSignupEmbed(eventDoc);
            await interaction.message.edit({ embeds: [updatedEmbed] });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas zapisu na nagrywki: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas zapisywania.', ephemeral: true });
            }
        }
    }

    async checkScheduledEvents() {
        if (!this.client.database.connected) return;

        const dueEvents = await NagrywkiEvent.find({
            status: 'scheduled',
            scheduledAt: { $lte: new Date() }
        });

        if (dueEvents.length) {
            this.client.handler.logger.log('DEBUG', `Znaleziono ${dueEvents.length} nagrywek do wystartowania.`);
        }

        for (const eventDoc of dueEvents) {
            await this.startEvent(eventDoc);
        }
    }

    async startEvent(eventDoc) {
        const { client } = this;

        try {
            const guild = await client.guilds.fetch(eventDoc.guildId).catch(() => null);

            if (!guild) {
                client.handler.logger.log('NORMAL', `Nie udało się pobrać serwera ${eventDoc.guildId} - anuluję nagrywkę ${eventDoc._id}.`);
                eventDoc.status = 'cancelled';
                eventDoc.endedAt = new Date();
                await eventDoc.save();
                return;
            }

            eventDoc.status = 'started';
            eventDoc.startedAt = new Date();
            await eventDoc.save();
            const channel = guild.channels.cache.get(eventDoc.channelId)
                || await guild.channels.fetch(eventDoc.channelId).catch(() => null);
            const voiceChannel = guild.channels.cache.get(eventDoc.voiceChannelId)
                || await guild.channels.fetch(eventDoc.voiceChannelId).catch(() => null);

            client.handler.logger.log(
                'DEBUG',
                `Start nagrywki ${eventDoc._id} na "${guild.name}": kanał tekstowy=${channel ? 'OK' : 'BRAK'}, kanał głosowy=${voiceChannel ? 'OK' : 'BRAK'}.`
            );

            if (channel) {
                const staffRoleId = this.config.staffRole;
                const participantsList = eventDoc.participants.length
                    ? eventDoc.participants.map(p => `<@${p.userId}>`).join('\n')
                    : 'Brak zapisanych osób';

                const startEmbed = new EmbedBuilder()
                    .setTitle('🎬 START NAGRYWEK!')
                    .setColor('#57F287')
                    .addFields(
                        { name: 'Osoby zapisane', value: participantsList },
                        { name: 'Wbijajcie na', value: voiceChannel ? `🔊 <#${voiceChannel.id}>` : '🔊 Kanał nagrywek' }
                    )
                    .setTimestamp();

                try {
                    await channel.send({
                        content: staffRoleId ? `<@&${staffRoleId}>` : undefined,
                        embeds: [startEmbed],
                        allowedMentions: {
                            roles: staffRoleId ? [staffRoleId] : [],
                            users: eventDoc.participants.map(p => p.userId)
                        }
                    });
                    client.handler.logger.log('DEBUG', `Wiadomość startowa nagrywki ${eventDoc._id} wysłana na kanał #${channel.name}.`);
                } catch (error) {
                    client.handler.logger.log(
                        'NORMAL',
                        `Nie udało się wysłać wiadomości startowej nagrywki ${eventDoc._id} na kanale #${channel.name} (${channel.id}): ${error.message}. ` +
                        'Sprawdź, czy bot ma na tym kanale uprawnienia "Wyświetlaj kanał", "Wysyłaj wiadomości" i "Osadzaj linki".'
                    );
                }
            } else {
                client.handler.logger.log(
                    'NORMAL',
                    `Nie znaleziono kanału tekstowego (${eventDoc.channelId}) dla nagrywki ${eventDoc._id} na serwerze "${guild.name}" - nic nie zostało wysłane. ` +
                    'Kanał mógł zostać usunięty, albo bot nie ma do niego dostępu (uprawnienie "Wyświetlaj kanał").'
                );
            }

            if (voiceChannel) {
                const presentStates = guild.voiceStates.cache.filter(
                    vs => vs.channelId === voiceChannel.id && vs.id !== client.user.id
                );

                for (const voiceState of presentStates.values()) {
                    await this.registerAttendee(eventDoc, guild.id, voiceState.id);
                }

                if (this.config.autoJoinVoiceChannel) {
                    await this.joinVoiceChannel(guild, voiceChannel);
                }
            } else {
                client.handler.logger.log(
                    'NORMAL',
                    `Nie znaleziono kanału głosowego (${eventDoc.voiceChannelId}) dla nagrywki ${eventDoc._id} na serwerze "${guild.name}" - bot nigdzie nie dołączył. ` +
                    'Kanał mógł zostać usunięty, albo bot nie ma do niego dostępu (uprawnienie "Wyświetlaj kanał"/"Dołącz").'
                );
            }

            client.handler.logger.log('NORMAL', `Rozpoczęto nagrywki na serwerze ${guild.name} (event: ${eventDoc._id}).`);
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas rozpoczynania nagrywek: ${error.stack || error.message}`);
        }
    }

    async joinVoiceChannel(guild, voiceChannel) {
        if (!voice) {
            this.client.handler.logger.log(
                'NORMAL',
                'Nie można dołączyć do kanału głosowego - brak pakietu @discordjs/voice. ' +
                'Zainstaluj: npm install @discordjs/voice libsodium-wrappers'
            );
            return;
        }

        try {
            voice.joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false
            });
            this.client.handler.logger.log('DEBUG', `Bot dołączył na kanał głosowy "${voiceChannel.name}".`);
        } catch (error) {
            this.client.handler.logger.log('NORMAL', `Błąd podczas dołączania na kanał głosowy: ${error.message}`);
        }
    }

    leaveVoiceChannel(guildId) {
        if (!voice) return;

        try {
            const connection = voice.getVoiceConnection(guildId);
            if (connection) connection.destroy();
        } catch (error) {
            this.client.handler.logger.log('NORMAL', `Błąd podczas opuszczania kanału głosowego: ${error.message}`);
        }
    }

    async onVoiceStateUpdate(oldState, newState) {
        try {
            if (!newState.channelId || newState.channelId === oldState.channelId) return;
            if (newState.member?.user?.bot) return;

            const eventDoc = await NagrywkiEvent.findOne({
                guildId: newState.guild.id,
                voiceChannelId: newState.channelId,
                status: 'started'
            });

            if (!eventDoc) return;

            await this.registerAttendee(eventDoc, newState.guild.id, newState.id);
        } catch (error) {
            this.client.handler.logger.log('NORMAL', `Błąd monitorowania obecności na nagrywkach: ${error.message}`);
        }
    }

    async registerAttendee(eventDoc, guildId, userId) {
        if (eventDoc.attendees.includes(userId)) return;

        eventDoc.attendees.push(userId);
        await eventDoc.save();

        await NagrywkiStats.findOneAndUpdate(
            { guildId, userId },
            { $inc: { joinCount: 1 } },
            { upsert: true }
        );
    }

    async endEvent(interaction) {
        const { client } = this;

        try {
            const isAdmin = Boolean(this.config.adminRole) && interaction.member.roles.cache.has(this.config.adminRole);

            const eventDoc = await NagrywkiEvent.findOne({
                guildId: interaction.guild.id,
                status: { $in: ['started', 'scheduled'] },
                ...(isAdmin ? {} : { organizerId: interaction.user.id })
            }).sort({ createdAt: -1 });

            if (!eventDoc) {
                return interaction.reply({
                    content: '❌ Nie znaleziono aktywnego wydarzenia nagrywek, które mógłbyś/mogłabyś zakończyć.',
                    ephemeral: true
                });
            }

            const channel = interaction.guild.channels.cache.get(eventDoc.channelId);

            if (eventDoc.status === 'scheduled') {
                eventDoc.status = 'cancelled';
                eventDoc.endedAt = new Date();
                await eventDoc.save();

                if (channel) {
                    await channel.send(`⚪ Nagrywki zaplanowane na **${eventDoc.time}** zostały anulowane przez <@${interaction.user.id}>.`);
                }

                return interaction.reply({ content: '✅ Zaplanowane wydarzenie zostało anulowane.', ephemeral: true });
            }

            eventDoc.status = 'finished';
            eventDoc.endedAt = new Date();
            await eventDoc.save();

            this.leaveVoiceChannel(interaction.guild.id);

            const durationMs = eventDoc.endedAt.getTime() - eventDoc.startedAt.getTime();
            const present = eventDoc.participants.filter(p => eventDoc.attendees.includes(p.userId));
            const absent = eventDoc.participants.filter(p => !eventDoc.attendees.includes(p.userId));

            const summaryEmbed = new EmbedBuilder()
                .setTitle('🎬 Podsumowanie nagrywek')
                .setColor('#e662eb')
                .addFields(
                    { name: '👑 Organizator', value: `<@${eventDoc.organizerId}>` },
                    { name: '⏱ Czas trwania', value: this.formatDuration(durationMs) },
                    {
                        name: '👥 Uczestnicy',
                        value: present.length ? present.map(p => `✅ <@${p.userId}>`).join('\n') : 'Brak'
                    }
                )
                .setTimestamp();

            if (absent.length) {
                summaryEmbed.addFields({
                    name: '❌ Nieobecni',
                    value: absent.map(p => `<@${p.userId}>`).join('\n')
                });
            }

            if (channel) {
                await channel.send({ embeds: [summaryEmbed] });
            }

            await interaction.reply({ content: '✅ Nagrywki zostały zakończone.', ephemeral: true });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas kończenia nagrywek: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas kończenia nagrywek.', ephemeral: true });
            }
        }
    }

    async showStats(interaction) {
        const { client } = this;

        try {
            const stats = await NagrywkiStats.find({ guildId: interaction.guild.id })
                .sort({ joinCount: -1 })
                .limit(10);

            if (!stats.length) {
                return interaction.reply({ content: 'Brak jeszcze żadnych statystyk nagrywek na tym serwerze.', ephemeral: true });
            }

            const medals = ['🥇', '🥈', '🥉'];
            const lines = stats.map((entry, index) => {
                const prefix = medals[index] || `${index + 1}.`;
                return `${prefix} <@${entry.userId}> - ${entry.joinCount} ${this.pluralizeWejscia(entry.joinCount)}`;
            });

            const embed = new EmbedBuilder()
                .setTitle('🎥 Statystyki nagrywek')
                .setColor('#e662eb')
                .setDescription(lines.join('\n'))
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas pobierania statystyk nagrywek: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas pobierania statystyk.', ephemeral: true });
            }
        }
    }

    buildSignupEmbed(eventDoc) {
        const participantsCount = eventDoc.participants.length;
        const participantsList = participantsCount
            ? eventDoc.participants.map(p => `<@${p.userId}>`).join(', ')
            : 'Brak zapisanych osób';

        const embed = new EmbedBuilder()
            .setTitle('🎬 Nagrywki')
            .setColor('#e662eb')
            .addFields(
                { name: '🕒 Godzina', value: eventDoc.time, inline: true },
                { name: '🔊 Kanał', value: `<#${eventDoc.voiceChannelId}>`, inline: true },
                { name: '👑 Organizator', value: `<@${eventDoc.organizerId}>`, inline: true },
                { name: `👥 Zapisani (${participantsCount})`, value: participantsList }
            )
            .setTimestamp();

        if (eventDoc.description) {
            embed.setDescription(eventDoc.description);
        }

        if (eventDoc.status === 'started') {
            embed.setFooter({ text: '🔴 Nagrywki właśnie trwają!' });
        } else if (eventDoc.status === 'finished' || eventDoc.status === 'cancelled') {
            embed.setFooter({ text: '⚪ Wydarzenie zakończone' });
        }

        return embed;
    }

    buildSignupButtons(eventId) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`nagrywki_join_${eventId}`)
                .setLabel('Będę')
                .setEmoji('🟢')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`nagrywki_leave_${eventId}`)
                .setLabel('Anuluj udział')
                .setEmoji('🔴')
                .setStyle(ButtonStyle.Secondary)
        );

        return row;
    }

    parseTime(timeStr) {
        if (typeof timeStr !== 'string') return null;
        const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(timeStr.trim());
        if (!match) return null;
        return { hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) };
    }

    getTimezone() {
        return this.config.timezone || 'Europe/Warsaw';
    }

    getTimezoneOffsetMinutes(timeZone, date) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).formatToParts(date).reduce((acc, part) => {
            if (part.type !== 'literal') acc[part.type] = part.value;
            return acc;
        }, {});

        const asUtc = Date.UTC(
            Number(parts.year), Number(parts.month) - 1, Number(parts.day),
            parts.hour === '24' ? 0 : Number(parts.hour), Number(parts.minute), Number(parts.second)
        );

        return Math.round((asUtc - date.getTime()) / 60000);
    }

    computeScheduledDate(hour, minute) {
        const timeZone = this.getTimezone();
        const now = new Date();
        const offsetMinutes = this.getTimezoneOffsetMinutes(timeZone, now);
        const nowInTz = new Date(now.getTime() + offsetMinutes * 60000);

        const targetUtcMs = Date.UTC(
            nowInTz.getUTCFullYear(), nowInTz.getUTCMonth(), nowInTz.getUTCDate(),
            hour, minute, 0, 0
        ) - offsetMinutes * 60000;

        let scheduled = new Date(targetUtcMs);

        if (scheduled.getTime() <= now.getTime()) {
            scheduled = new Date(scheduled.getTime() + 24 * 60 * 60 * 1000);
        }

        return scheduled;
    }

    formatDuration(ms) {
        const totalMinutes = Math.max(0, Math.round(ms / 60000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours === 0) return `${minutes}min`;
        return `${hours}h ${minutes}min`;
    }

    pluralizeWejscia(count) {
        if (count === 1) return 'wejście';

        const lastDigit = count % 10;
        const lastTwoDigits = count % 100;

        if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwoDigits >= 12 && lastTwoDigits <= 14)) {
            return 'wejścia';
        }

        return 'wejść';
    }
}

module.exports = NagrywkiManager;
