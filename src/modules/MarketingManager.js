const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, UserSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const NagrywkiEvent = require('../models/NagrywkiEvent');
const MarketingEmployee = require('../models/MarketingEmployee');
const PayrollReport = require('../models/PayrollReport');
const AnalystReport = require('../models/AnalystReport');
const EmployeeNote = require('../models/EmployeeNote');
const MonthlyGoal = require('../models/MonthlyGoal');
const MarketingReminder = require('../models/MarketingReminder');
const MarketingAdjustment = require('../models/MarketingAdjustment');
const { getWarsawMonthRange, daysRemainingInMonth } = require('../utils/period');

const DZIAL_LABELS = {
    nagrywajacy: '🎥 Nagrywający',
    analityk: '📊 Analityk',
    aktor: '🎭 Aktor'
};

const RANGA_LABELS = {
    junior: '🟢 Junior',
    regular: '🔵 Regular',
    senior: '🟣 Senior'
};

const BASE_RATES = {
    nagrywajacy: { junior: 150, regular: 250, senior: 350 },
    analityk: { junior: 125, regular: 200, senior: 325 },
    aktor: { junior: 100, regular: 175, senior: 300 }
};

const MAX_PAYOUT = 350;

const DZIAL_ORDER = ['nagrywajacy', 'analityk', 'aktor'];

class MarketingManager {
    constructor(client) {
        this.client = client;
        this.reminderTimer = null;
    }

    init() {
        const config = this.client.config.marketing || {};
        const intervalMs = config.reminderCheckIntervalMs || 21600000;

        if (!config.reminderChannelId && !config.directorId) {
            this.client.handler.logger.log('NORMAL', 'Przypomnienia Marketingu wyłączone (brak reminderChannelId i directorId w config.json).');
            return;
        }

        setTimeout(() => this.checkMonthEndReminders().catch(error => {
            this.client.handler.logger.log('NORMAL', `Błąd podczas sprawdzania przypomnień Marketingu: ${error.message}`);
        }), 15000);

        this.reminderTimer = setInterval(() => {
            this.checkMonthEndReminders().catch(error => {
                this.client.handler.logger.log('NORMAL', `Błąd podczas sprawdzania przypomnień Marketingu: ${error.message}`);
            });
        }, intervalMs);

        this.client.handler.logger.log('NORMAL', 'Moduł przypomnień Marketingu uruchomiony.');
    }

    async checkMonthEndReminders() {
        const config = this.client.config.marketing || {};
        const reminderDays = config.reminderDaysBefore || [3, 1, 0];
        const remaining = daysRemainingInMonth();

        if (!reminderDays.includes(remaining)) return;

        const { periodLabel, displayLabel } = getWarsawMonthRange(0);

        for (const [guildId, guild] of this.client.guilds.cache) {
            try {
                const existingReport = await PayrollReport.findOne({ guildId, periodLabel });
                if (existingReport) continue;

                const alreadySent = await MarketingReminder.findOne({ guildId, periodLabel, daysRemaining: remaining });
                if (alreadySent) continue;

                const sent = await this.sendMonthEndReminder(guild, config, displayLabel, remaining);
                if (sent) {
                    await MarketingReminder.create({ guildId, periodLabel, daysRemaining: remaining });
                }
            } catch (error) {
                this.client.handler.logger.log('NORMAL', `Błąd przypomnienia Marketingu dla serwera ${guildId}: ${error.message}`);
            }
        }
    }

    async sendMonthEndReminder(guild, config, displayLabel, remaining) {
        const text = remaining === 0
            ? `📅 To ostatni dzień miesiąca (**${displayLabel}**) - pamiętaj o wygenerowaniu raportu wypłat: \`/raport-wyplat\`.`
            : `📅 Zostały **${remaining}** ${remaining === 1 ? 'dzień' : 'dni'} do końca miesiąca (**${displayLabel}**) - po jego zakończeniu nie zapomnij o \`/raport-wyplat\`.`;

        if (config.reminderChannelId) {
            try {
                const channel = guild.channels.cache.get(config.reminderChannelId)
                    || await guild.channels.fetch(config.reminderChannelId).catch(() => null);

                if (channel) {
                    const mention = config.adminRole ? `<@&${config.adminRole}> ` : '';
                    await channel.send({
                        content: `${mention}${text}`,
                        allowedMentions: { roles: config.adminRole ? [config.adminRole] : [] }
                    });
                    return true;
                }
            } catch (error) {
                this.client.handler.logger.log('NORMAL', `Nie udało się wysłać przypomnienia na kanał: ${error.message}`);
            }
        }

        if (config.directorId) {
            try {
                const user = await this.client.users.fetch(config.directorId).catch(() => null);
                if (user) {
                    await user.send({ content: text });
                    return true;
                }
            } catch (error) {
                this.client.handler.logger.log('NORMAL', `Nie udało się wysłać przypomnienia na DM Dyrektora: ${error.message}`);
            }
        }

        return false;
    }

    async _applyRanga(guild, userId, ranga) {
        await MarketingEmployee.findOneAndUpdate(
            { guildId: guild.id, userId },
            { $set: { ranga } },
            { upsert: true }
        );
        return this.syncCategoryRole(guild, userId, 'ranga', ranga);
    }

    async _applyDzial(guild, userId, dzial) {
        await MarketingEmployee.findOneAndUpdate(
            { guildId: guild.id, userId },
            { $set: { dzial } },
            { upsert: true }
        );
        return this.syncCategoryRole(guild, userId, 'dzial', dzial);
    }

    async setRanga(interaction, targetUser, ranga) {
        const { client } = this;

        try {
            const roleWarning = await this._applyRanga(interaction.guild, targetUser.id, ranga);

            await interaction.reply({
                content: `✅ Ustawiono rangę ${RANGA_LABELS[ranga]} dla ${targetUser}.${roleWarning}`,
                ephemeral: true
            });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas ustawiania rangi: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas ustawiania rangi.', ephemeral: true });
            }
        }
    }

    async setDzial(interaction, targetUser, dzial) {
        const { client } = this;

        try {
            const roleWarning = await this._applyDzial(interaction.guild, targetUser.id, dzial);

            await interaction.reply({
                content: `✅ Ustawiono dział ${DZIAL_LABELS[dzial]} dla ${targetUser}.${roleWarning}`,
                ephemeral: true
            });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas ustawiania działu: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas ustawiania działu.', ephemeral: true });
            }
        }
    }
    async syncCategoryRole(guild, userId, category, newKey) {
        const roleMap = this.client.config.marketing?.roles?.[category];
        if (!roleMap) return '';

        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return '\n⚠️ Nie udało się pobrać członka serwera, aby zsynchronizować rolę.';

            const allRoleIds = Object.values(roleMap).filter(Boolean);
            const targetRoleId = roleMap[newKey];

            const rolesToRemove = allRoleIds.filter(id => id !== targetRoleId && member.roles.cache.has(id));
            if (rolesToRemove.length) {
                await member.roles.remove(rolesToRemove).catch(() => null);
            }

            if (!targetRoleId) {
                return `\n⚠️ Brak skonfigurowanej roli Discord dla "${newKey}" w config.json (marketing.roles.${category}) - rola NIE została nadana.`;
            }

            if (!guild.roles.cache.has(targetRoleId)) {
                return `\n⚠️ Rola o ID ${targetRoleId} nie istnieje na tym serwerze - sprawdź config.json.`;
            }

            if (!member.roles.cache.has(targetRoleId)) {
                await member.roles.add(targetRoleId);
            }

            return '';
        } catch (error) {
            this.client.handler.logger.log('NORMAL', `Błąd synchronizacji roli Discord (${category}): ${error.message}`);
            return '\n⚠️ Wystąpił błąd podczas nadawania roli Discord (sprawdź uprawnienia bota / hierarchię ról).';
        }
    }

    async resetEmployee(interaction, targetUser) {
        const { client } = this;

        try {
            const guild = interaction.guild;
            const roleMap = client.config.marketing?.roles;

            if (roleMap) {
                const member = await guild.members.fetch(targetUser.id).catch(() => null);
                if (member) {
                    const allRoleIds = [
                        ...Object.values(roleMap.dzial || {}),
                        ...Object.values(roleMap.ranga || {})
                    ].filter(Boolean);

                    const rolesToRemove = allRoleIds.filter(id => member.roles.cache.has(id));
                    if (rolesToRemove.length) {
                        await member.roles.remove(rolesToRemove).catch(() => null);
                    }
                }
            }

            await MarketingEmployee.findOneAndUpdate(
                { guildId: guild.id, userId: targetUser.id },
                { $set: { dzial: null, ranga: null } },
                { upsert: true }
            );

            const deletedReports = await AnalystReport.deleteMany({ guildId: guild.id, userId: targetUser.id });
            const deletedAdjustments = await MarketingAdjustment.deleteMany({ guildId: guild.id, userId: targetUser.id });

            await interaction.reply({
                content: `✅ Zresetowano ${targetUser}: dział, ranga i role Discord wyczyszczone, ` +
                    `usunięto ${deletedReports.deletedCount} zgłoszeń analitycznych oraz ${deletedAdjustments.deletedCount} ręcznych korekt wypłaty (jeszcze nie ujętych w żadnym wysłanym raporcie). ` +
                    `Osoba nie pojawi się w kolejnym raporcie wypłat, dopóki nie zostanie ponownie przypisana przez /dzial i /ranga.\n\n` +
                    `ℹ️ Historia obecności na nagrywkach oraz już wygenerowane raporty wypłat (/historia-wyplat) NIE zostały ruszone.`,
                ephemeral: true
            });

            client.handler.logger.log('NORMAL', `${interaction.user.tag} zresetował/a profil Marketingu użytkownika ${targetUser.tag} (${targetUser.id}).`);
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas resetowania pracownika: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas resetowania pracownika.', ephemeral: true });
            }
        }
    }

    async recordAdjustment(interaction, targetUser, delta, reason) {
        const { client } = this;

        try {
            const guildId = interaction.guild.id;
            const employee = await MarketingEmployee.findOne({ guildId, userId: targetUser.id });

            if (!employee || !employee.dzial || !employee.ranga) {
                return interaction.reply({
                    content: `❌ ${targetUser} nie ma jeszcze ustawionego działu i rangi (\`/dzial\`, \`/ranga\`) - przypisz go najpierw, dopiero potem można korygować wypłatę.`,
                    ephemeral: true
                });
            }

            let { periodLabel, displayLabel } = getWarsawMonthRange(0);
            let deferredNote = '';
            const existingReport = await PayrollReport.findOne({ guildId, periodLabel });
            if (existingReport) {
                const next = getWarsawMonthRange(-1);
                periodLabel = next.periodLabel;
                displayLabel = next.displayLabel;
                deferredNote = ` (raport za bieżący miesiąc jest już wysłany, więc ta korekta wejdzie do raportu za **${displayLabel}**)`;
            }

            await MarketingAdjustment.create({
                guildId,
                userId: targetUser.id,
                periodLabel,
                amount: delta,
                reason: reason || null,
                createdBy: interaction.user.id
            });

            const sign = delta > 0 ? '+' : '';
            await interaction.reply({
                content: `✅ Zapisano korektę wypłaty dla ${targetUser}: **${sign}${delta} BC** (okres: ${displayLabel})${deferredNote}.` +
                    (reason ? `\nPowód: ${reason}` : ''),
                ephemeral: true
            });

            client.handler.logger.log('NORMAL', `${interaction.user.tag} ${delta > 0 ? 'dodał/a' : 'odjął/odjęła'} ${Math.abs(delta)} BC dla ${targetUser.tag} (${periodLabel}).`);
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas zapisywania korekty wypłaty: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas zapisywania korekty wypłaty.', ephemeral: true });
            }
        }
    }

    async submitAnalystReport(interaction, { tytul, opis, muzyka, linkInspiracyjny }) {
        const { client } = this;

        try {
            const employee = await MarketingEmployee.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });

            if (!employee || employee.dzial !== 'analityk') {
                return interaction.reply({
                    content: '❌ Ta komenda jest tylko dla osób przypisanych do działu 📊 Analityk.',
                    ephemeral: true
                });
            }

            const report = await AnalystReport.create({
                guildId: interaction.guild.id,
                userId: interaction.user.id,
                tytul,
                opis,
                muzyka,
                linkInspiracyjny,
                status: 'oczekujacy'
            });

            const embed = this.buildAnalystReportEmbed(report, interaction.user);
            const row = this.buildAnalystReportRow(report._id, false);

            const config = client.config.marketing || {};
            let targetChannel = interaction.channel;

            if (config.reportsChannelId) {
                const fetched = interaction.guild.channels.cache.get(config.reportsChannelId)
                    || await interaction.guild.channels.fetch(config.reportsChannelId).catch(() => null);
                if (fetched) targetChannel = fetched;
            }

            const sentMessage = await targetChannel.send({ embeds: [embed], components: [row] });

            report.messageId = sentMessage.id;
            report.channelId = targetChannel.id;
            await report.save();

            await interaction.reply({
                content: `✅ Zgłoszenie wysłane do akceptacji w ${targetChannel}. Dopiero po kliknięciu "Akceptuj" przez Dyrektora wliczy się ono do Twojej aktywności.`,
                ephemeral: true
            });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas zapisu raportu analitycznego: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas zapisywania raportu.', ephemeral: true });
            }
        }
    }

    buildAnalystReportEmbed(report, submitterUser) {
        const isAccepted = report.status === 'zaakceptowany';

        const embed = new EmbedBuilder()
            .setTitle(`🎬 ${report.tytul}`)
            .setColor(isAccepted ? '#57F287' : '#e662eb')
            .addFields(
                { name: 'Opis', value: report.opis },
                { name: 'Muzyka', value: report.muzyka },
                { name: 'Link inspiracyjny', value: report.linkInspiracyjny },
                { name: 'Zgłosił/a', value: `<@${report.userId}>`, inline: true },
                { name: 'Status', value: isAccepted ? `✅ Zaakceptowane przez <@${report.acceptedBy}>` : '⏳ Oczekuje na akceptację Dyrektora', inline: true }
            )
            .setTimestamp(report.createdAt || new Date());

        return embed;
    }

    buildAnalystReportRow(reportId, isAccepted) {
        const button = new ButtonBuilder()
            .setCustomId(`analyst_accept_${reportId}`)
            .setLabel(isAccepted ? 'Zaakceptowano' : '✅ Akceptuj')
            .setStyle(isAccepted ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setDisabled(isAccepted);

        return new ActionRowBuilder().addComponents(button);
    }

    async acceptAnalystReport(interaction, reportId) {
        const { client } = this;
        const config = client.config.marketing;

        try {
            if (!config || !config.adminRole || !interaction.member.roles.cache.has(config.adminRole)) {
                return interaction.reply({ content: '❌ Tylko Dyrektor Marketingu może akceptować zgłoszenia.', ephemeral: true });
            }

            const report = await AnalystReport.findById(reportId);
            if (!report) {
                return interaction.reply({ content: '❌ Nie znaleziono tego zgłoszenia (mogło zostać usunięte).', ephemeral: true });
            }

            if (report.status === 'zaakceptowany') {
                return interaction.reply({ content: `ℹ️ To zgłoszenie zostało już zaakceptowane przez <@${report.acceptedBy}>.`, ephemeral: true });
            }

            report.status = 'zaakceptowany';
            report.acceptedBy = interaction.user.id;
            report.acceptedAt = new Date();
            await report.save();

            const submitterUser = await client.users.fetch(report.userId).catch(() => null);
            const embed = this.buildAnalystReportEmbed(report, submitterUser);
            const row = this.buildAnalystReportRow(report._id, true);

            await interaction.update({ embeds: [embed], components: [row] });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas akceptacji raportu analitycznego: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas akceptacji zgłoszenia.', ephemeral: true });
            }
        }
    }

    getActivityTier(activityCount) {
        if (activityCount >= 3) return { label: '🔺 Wysoka', multiplier: 1.2 };
        if (activityCount === 2) return { label: '🔶 Średnia', multiplier: 1.1 };
        if (activityCount === 1) return { label: '🔸 Niska', multiplier: 1.0 };
        return { label: '⚪ Brak', multiplier: 0 };
    }

    calculatePayout(dzial, ranga, activityCount) {
        const base = BASE_RATES[dzial]?.[ranga];
        if (!base || !activityCount) return 0;

        const tier = this.getActivityTier(activityCount);
        const payout = Math.round(base * tier.multiplier);

        return Math.min(payout, MAX_PAYOUT);
    }

    async getPeriodActivity(guildId, start, end) {
        const events = await NagrywkiEvent.find({
            guildId,
            status: 'finished',
            startedAt: { $gte: start, $lt: end }
        });

        const attendeeCounts = new Map();
        for (const eventDoc of events) {
            for (const userId of eventDoc.attendees) {
                attendeeCounts.set(userId, (attendeeCounts.get(userId) || 0) + 1);
            }
        }

        const reportAgg = await AnalystReport.aggregate([
            { $match: { guildId, status: 'zaakceptowany', createdAt: { $gte: start, $lt: end } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } }
        ]);
        const analystCounts = new Map(reportAgg.map(r => [r._id, r.count]));

        return { attendeeCounts, analystCounts, eventCount: events.length };
    }

    activityCountFor(dzial, userId, attendeeCounts, analystCounts) {
        if (dzial === 'analityk') return analystCounts.get(userId) || 0;
        if (dzial === 'nagrywajacy' || dzial === 'aktor') return attendeeCounts.get(userId) || 0;
        return 0;
    }

    async generateReport(interaction, monthsAgo = 0) {
        const { client } = this;

        try {
            await interaction.deferReply({ ephemeral: true });

            const guildId = interaction.guild.id;
            const { start, end, periodLabel, displayLabel } = getWarsawMonthRange(monthsAgo);

            const existing = await PayrollReport.findOne({ guildId, periodLabel });
            if (existing) {
                return interaction.editReply({
                    content: `⚠️ Raport za **${displayLabel}** już istnieje (wygenerowany ${this.formatFullDate(existing.createdAt)}). ` +
                        `Użyj \`/historia-wyplat\`, żeby go zobaczyć - nie generuję drugi raz tego samego okresu (ryzyko podwójnej wypłaty).`
                });
            }

            const { attendeeCounts, analystCounts } = await this.getPeriodActivity(guildId, start, end);

            const adjustmentAgg = await MarketingAdjustment.aggregate([
                { $match: { guildId, periodLabel } },
                { $group: { _id: '$userId', total: { $sum: '$amount' } } }
            ]);
            const adjustmentMap = new Map(adjustmentAgg.map(a => [a._id, a.total]));

            const activeUserIds = new Set([...attendeeCounts.keys(), ...analystCounts.keys(), ...adjustmentMap.keys()]);

            if (!activeUserIds.size) {
                return interaction.editReply({
                    content: `ℹ️ Brak jakiejkolwiek zarejestrowanej aktywności (nagrywki/raporty/korekty) w **${displayLabel}**. Nie ma czego rozliczać.`
                });
            }

            const employees = await MarketingEmployee.find({
                guildId,
                userId: { $in: [...activeUserIds] },
                dzial: { $ne: null },
                ranga: { $ne: null }
            });

            const entries = [];
            for (const employee of employees) {
                const activityCount = this.activityCountFor(employee.dzial, employee.userId, attendeeCounts, analystCounts);
                const basePayout = this.calculatePayout(employee.dzial, employee.ranga, activityCount);
                const adjustment = adjustmentMap.get(employee.userId) || 0;
                const payout = Math.max(0, basePayout + adjustment);

                if (payout > 0) {
                    entries.push({ userId: employee.userId, dzial: employee.dzial, ranga: employee.ranga, activityCount, adjustment, payout });
                }
            }

            const assignedIds = new Set(employees.map(e => e.userId));
            const unassignedUserIds = [...activeUserIds].filter(id => !assignedIds.has(id));

            const totalAmount = entries.reduce((sum, e) => sum + e.payout, 0);

            if (!entries.length) {
                return interaction.editReply({
                    content: `ℹ️ Były osoby aktywne w **${displayLabel}**, ale żadna z nich nie ma ustawionego działu i rangi (\`/dzial\`, \`/ranga\`), ` +
                        `więc nie da się policzyć wypłat.\n` +
                        (unassignedUserIds.length ? `Nieprzypisani: ${unassignedUserIds.map(id => `<@${id}>`).join(', ')}` : '')
                });
            }

            const reportDoc = await PayrollReport.create({
                guildId,
                generatedBy: interaction.user.id,
                periodLabel,
                periodStart: start,
                periodEnd: end,
                entries,
                unassignedUserIds,
                totalAmount,
                employeeCount: entries.length
            });

            const reportText = await this.buildReportText(reportDoc, interaction.guild, displayLabel);

            let dmSent = true;
            try {
                await interaction.user.send({ content: reportText });
            } catch (error) {
                dmSent = false;
            }

            if (dmSent) {
                await interaction.editReply({ content: `✅ Raport wypłat za **${displayLabel}** został wygenerowany i wysłany do Ciebie na DM!` });
            } else {
                await interaction.editReply({
                    content: `⚠️ Nie udało się wysłać raportu na DM (masz zablokowane wiadomości prywatne od bota?). Oto raport tutaj:\n\n${reportText}`
                });
            }

            client.handler.logger.log('NORMAL', `Wygenerowano raport wypłat Marketingu za ${periodLabel} (${entries.length} pracowników, ${totalAmount} BC).`);
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas generowania raportu wypłat: ${error.stack || error.message}`);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas generowania raportu wypłat.' });
            } else {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas generowania raportu wypłat.', ephemeral: true });
            }
        }
    }
    async buildReportText(reportDoc, guild, displayLabel) {
        const lines = [];

        for (const entry of reportDoc.entries) {
            const nick = await this.resolveNick(guild, entry.userId);
            lines.push(`${entry.userId} - ${nick} - ${entry.payout} BC`);
        }

        let text = `📋 RAPORT WYPŁAT - MARKETING\nOkres: ${displayLabel}\n\n` + lines.join('\n');
        text += `\n\n💰 Łącznie: ${reportDoc.totalAmount} BC | 👥 Pracownicy: ${reportDoc.employeeCount}`;

        if (reportDoc.unassignedUserIds.length) {
            text += `\n\n⚠️ Aktywni w tym miesiącu, ale bez ustawionego działu/rangi (pominięci): ` +
                reportDoc.unassignedUserIds.join(', ');
        }

        const adjusted = reportDoc.entries.filter(e => e.adjustment);
        if (adjusted.length) {
            const adjLines = adjusted.map(e => {
                const sign = e.adjustment > 0 ? '+' : '';
                return `${e.userId} - ${sign}${e.adjustment} BC`;
            });
            text += `\n\n💵 W tym ręczne korekty (/dodaj-wyplate, /usun-wyplate), już wliczone w kwoty powyżej:\n` + adjLines.join('\n');
        }

        return text;
    }

    async resolveNick(guild, userId) {
        try {
            const member = await guild.members.fetch(userId);
            return member.displayName;
        } catch (error) {
            try {
                const user = await this.client.users.fetch(userId);
                return user.username;
            } catch (innerError) {
                return userId;
            }
        }
    }

    async showHistory(interaction, numer) {
        const { client } = this;

        try {
            const reports = await PayrollReport.find({ guildId: interaction.guild.id })
                .sort({ periodStart: -1 })
                .limit(24);

            if (!reports.length) {
                return interaction.reply({ content: 'Brak jeszcze żadnych wygenerowanych raportów wypłat.', ephemeral: true });
            }

            if (numer) {
                const report = reports[numer - 1];

                if (!report) {
                    return interaction.reply({
                        content: `❌ Nie znaleziono raportu o numerze ${numer}. Dostępne numery: 1-${reports.length}.`,
                        ephemeral: true
                    });
                }

                const text = await this.buildReportText(report, interaction.guild, report.periodLabel);
                return interaction.reply({ content: text, ephemeral: true });
            }

            const lines = reports.map((report, index) => {
                return `**${index + 1}.** ${report.periodLabel} - Łącznie: **${report.totalAmount} BC**, Pracowników: **${report.employeeCount}**`;
            });

            const embed = new EmbedBuilder()
                .setTitle('📚 HISTORIA WYPŁAT')
                .setColor('#e662eb')
                .setDescription(lines.join('\n'))
                .setFooter({ text: 'Użyj /historia-wyplat numer:<numer> aby zobaczyć pełną listę wypłat z konkretnego miesiąca.' });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas pobierania historii wypłat: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas pobierania historii wypłat.', ephemeral: true });
            }
        }
    }

    async showStatystyki(interaction, targetUser) {
        const { client } = this;

        try {
            const guildId = interaction.guild.id;
            const employee = await MarketingEmployee.find({ guildId, userId: targetUser.id }).then(r => r[0]);

            if (!employee || !employee.dzial || !employee.ranga) {
                return interaction.reply({
                    content: `ℹ️ ${targetUser} nie ma jeszcze przypisanego działu i/lub rangi w Marketingu.`,
                    ephemeral: true
                });
            }

            const { start, end, periodLabel, displayLabel } = getWarsawMonthRange(0);
            const { attendeeCounts, analystCounts } = await this.getPeriodActivity(guildId, start, end);
            const activityCount = this.activityCountFor(employee.dzial, targetUser.id, attendeeCounts, analystCounts);
            const tier = this.getActivityTier(activityCount);
            const basePayout = this.calculatePayout(employee.dzial, employee.ranga, activityCount);

            const adjustmentAgg = await MarketingAdjustment.aggregate([
                { $match: { guildId, userId: targetUser.id, periodLabel } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            const adjustment = adjustmentAgg[0]?.total || 0;
            const payout = Math.max(0, basePayout + adjustment);

            const activityLabel = employee.dzial === 'analityk' ? 'Raporty analityczne w tym miesiącu' : 'Nagrywki w tym miesiącu';

            const embed = new EmbedBuilder()
                .setTitle('📊 STATYSTYKI')
                .setColor('#e662eb')
                .addFields(
                    { name: 'Użytkownik', value: `${targetUser}`, inline: true },
                    { name: 'Ranga', value: RANGA_LABELS[employee.ranga], inline: true },
                    { name: 'Dział', value: DZIAL_LABELS[employee.dzial], inline: true },
                    { name: activityLabel, value: `${activityCount}`, inline: true },
                    { name: 'Aktywność', value: tier.label, inline: true },
                    { name: 'Wypłata (podgląd)', value: `${payout} BC`, inline: true }
                );

            if (adjustment) {
                embed.addFields({ name: 'W tym ręczna korekta', value: `${adjustment > 0 ? '+' : ''}${adjustment} BC`, inline: true });
            }

            embed.setFooter({ text: `Okres: ${displayLabel} · wypłata to podgląd na dziś, ostateczna wartość zostanie ustalona w raporcie na koniec miesiąca.` });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas pobierania statystyk: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas pobierania statystyk.', ephemeral: true });
            }
        }
    }

    async showFrekwencja(interaction, targetUser) {
        const { client } = this;

        try {
            const guildId = interaction.guild.id;
            const employee = await MarketingEmployee.findOne({ guildId, userId: targetUser.id });

            if (employee?.dzial === 'analityk') {
                return this.showAnalystFrekwencja(interaction, targetUser);
            }

            const events = await NagrywkiEvent.find({
                guildId,
                status: { $in: ['started', 'finished'] },
                'participants.userId': targetUser.id
            });

            if (!events.length) {
                return interaction.reply({
                    content: `ℹ️ ${targetUser} nie zapisywał/a się jeszcze na żadne nagrywki, które faktycznie się odbyły.`,
                    ephemeral: true
                });
            }

            const zapisy = events.length;
            const udzialy = events.filter(e => e.attendees.includes(targetUser.id)).length;
            const nieobecnosci = zapisy - udzialy;
            const frekwencjaPct = Math.round((udzialy / zapisy) * 100);

            const embed = new EmbedBuilder()
                .setTitle(`📊 FREKWENCJA - ${targetUser.username}`)
                .setColor('#e662eb')
                .addFields(
                    { name: 'Zapisy', value: `${zapisy}`, inline: true },
                    { name: 'Udziały', value: `${udzialy}`, inline: true },
                    { name: 'Nieobecności', value: `${nieobecnosci}`, inline: true },
                    { name: 'Frekwencja', value: `${frekwencjaPct}%` }
                )
                .setFooter({ text: 'Dane obejmują cały czas działania systemu nagrywek (nie tylko bieżący miesiąc).' });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas liczenia frekwencji: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas liczenia frekwencji.', ephemeral: true });
            }
        }
    }
    async showAnalystFrekwencja(interaction, targetUser) {
        const { client } = this;

        try {
            const guildId = interaction.guild.id;
            const allReports = await AnalystReport.find({ guildId, userId: targetUser.id });

            if (!allReports.length) {
                return interaction.reply({
                    content: `ℹ️ ${targetUser} (📊 Analityk) nie zgłosił/a jeszcze żadnego raportu przez \`/raport-analizy\`.`
                });
            }

            const zaakceptowane = allReports.filter(r => r.status === 'zaakceptowany').length;
            const zgloszone = allReports.length;
            const skutecznoscPct = Math.round((zaakceptowane / zgloszone) * 100);

            const embed = new EmbedBuilder()
                .setTitle(`📊 FREKWENCJA - ${targetUser.username} (📊 Analityk)`)
                .setColor('#e662eb')
                .setDescription('Analitycy nie są rozliczani z obecności na nagrywkach - tylko z zaakceptowanych raportów analitycznych.')
                .addFields(
                    { name: 'Zgłoszone raporty', value: `${zgloszone}`, inline: true },
                    { name: 'Zaakceptowane', value: `${zaakceptowane}`, inline: true },
                    { name: 'Skuteczność akceptacji', value: `${skutecznoscPct}%`, inline: true }
                )
                .setFooter({ text: 'Dane obejmują cały czas działania systemu (nie tylko bieżący miesiąc).' });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas liczenia frekwencji Analityka: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas liczenia frekwencji.', ephemeral: true });
            }
        }
    }

    async showPanel(interaction) {
        const { client } = this;

        try {
            const guildId = interaction.guild.id;
            const employees = await MarketingEmployee.find({ guildId, dzial: { $ne: null } });

            const byDzial = { nagrywajacy: 0, analityk: 0, aktor: 0 };
            const byRanga = { junior: 0, regular: 0, senior: 0 };
            for (const e of employees) {
                if (e.dzial) byDzial[e.dzial] = (byDzial[e.dzial] || 0) + 1;
                if (e.ranga) byRanga[e.ranga] = (byRanga[e.ranga] || 0) + 1;
            }

            const { start, end, displayLabel } = getWarsawMonthRange(0);
            const { attendeeCounts, analystCounts, eventCount } = await this.getPeriodActivity(guildId, start, end);
            const activeThisMonth = new Set([...attendeeCounts.keys(), ...analystCounts.keys()]).size;
            const reportCount = [...analystCounts.values()].reduce((sum, n) => sum + n, 0);

            const goal = await MonthlyGoal.findOne({ guildId, periodLabel: getWarsawMonthRange(0).periodLabel });

            const embed = new EmbedBuilder()
                .setTitle('📋 PANEL MARKETINGU')
                .setColor('#e662eb')
                .setDescription(`Okres: **${displayLabel}**`)
                .addFields(
                    { name: '👥 Pracownicy łącznie', value: `${employees.length}`, inline: true },
                    { name: '🟢 Junior', value: `${byRanga.junior}`, inline: true },
                    { name: '🔵 Regular', value: `${byRanga.regular}`, inline: true },
                    { name: '🟣 Senior', value: `${byRanga.senior}`, inline: true },
                    { name: '🎥 Nagrywający', value: `${byDzial.nagrywajacy}`, inline: true },
                    { name: '📊 Analitycy', value: `${byDzial.analityk}`, inline: true },
                    { name: '🎭 Aktorzy', value: `${byDzial.aktor}`, inline: true },
                    { name: '🎬 Nagrywki (ten miesiąc)', value: `${eventCount}`, inline: true },
                    { name: '📝 Raporty analityczne (ten miesiąc)', value: `${reportCount}`, inline: true },
                    { name: '🔥 Aktywni pracownicy (ten miesiąc)', value: `${activeThisMonth}`, inline: true }
                );

            if (goal) {
                embed.addFields({
                    name: '🎯 Cele miesięczne',
                    value: `Nagrywki: ${eventCount} / ${goal.targetNagrywki}\nRaporty: ${reportCount} / ${goal.targetRaporty}\nMateriały: ${goal.aktualneMaterialy} / ${goal.targetMaterialy}`
                });
            } else {
                embed.addFields({ name: '🎯 Cele miesięczne', value: 'Nie ustawiono jeszcze celów na ten miesiąc (`/cel-miesieczny ustaw`).' });
            }

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('mk_panel_manage').setLabel('👤 Zarządzaj pracownikiem').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('mk_panel_raport').setLabel('💰 Raport wypłat').setStyle(ButtonStyle.Success)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('mk_panel_historia').setLabel('📚 Historia wypłat').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('mk_panel_cele').setLabel('🎯 Cele miesięczne').setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({ embeds: [embed], components: [row1, row2] });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas budowania panelu Marketingu: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas budowania panelu.', ephemeral: true });
            }
        }
    }

    async addNote(interaction, targetUser, content) {
        const { client } = this;
        try {
            await EmployeeNote.create({
                guildId: interaction.guild.id,
                targetUserId: targetUser.id,
                authorId: interaction.user.id,
                content
            });

            await interaction.reply({ content: `✅ Dodano notatkę dla ${targetUser}.`, ephemeral: true });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas dodawania notatki: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas dodawania notatki.', ephemeral: true });
            }
        }
    }

    async listNotes(interaction, targetUser) {
        const { client } = this;
        try {
            const notes = await EmployeeNote.find({ guildId: interaction.guild.id, targetUserId: targetUser.id })
                .sort({ createdAt: -1 })
                .limit(15);

            if (!notes.length) {
                return interaction.reply({ content: `ℹ️ Brak notatek dla ${targetUser}.`, ephemeral: true });
            }

            const lines = notes.map((note, index) => {
                return `**${index + 1}.** [${this.formatFullDate(note.createdAt)}] <@${note.authorId}>: ${note.content}`;
            });

            const embed = new EmbedBuilder()
                .setTitle(`📝 NOTATKI - ${targetUser.username}`)
                .setColor('#e662eb')
                .setDescription(lines.join('\n\n'))
                .setFooter({ text: 'Widoczne wyłącznie dla osób z uprawnieniami Marketingu.' });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas pobierania notatek: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas pobierania notatek.', ephemeral: true });
            }
        }
    }

    async deleteNote(interaction, targetUser, numer) {
        const { client } = this;
        try {
            const notes = await EmployeeNote.find({ guildId: interaction.guild.id, targetUserId: targetUser.id })
                .sort({ createdAt: -1 })
                .limit(15);

            const note = notes[numer - 1];
            if (!note) {
                return interaction.reply({
                    content: `❌ Nie znaleziono notatki o numerze ${numer}. Użyj \`/notatka pokaz\`, żeby zobaczyć numery.`,
                    ephemeral: true
                });
            }

            await EmployeeNote.deleteOne({ _id: note._id });
            await interaction.reply({ content: '✅ Notatka została usunięta.', ephemeral: true });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas usuwania notatki: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas usuwania notatki.', ephemeral: true });
            }
        }
    }

    async setGoal(interaction, { nagrywki, raporty, materialy }) {
        const { client } = this;
        try {
            const { periodLabel, displayLabel } = getWarsawMonthRange(0);

            const update = { setBy: interaction.user.id };
            if (nagrywki !== null) update.targetNagrywki = nagrywki;
            if (raporty !== null) update.targetRaporty = raporty;
            if (materialy !== null) update.targetMaterialy = materialy;

            await MonthlyGoal.findOneAndUpdate(
                { guildId: interaction.guild.id, periodLabel },
                { $set: update },
                { upsert: true }
            );

            await interaction.reply({ content: `✅ Ustawiono cele na **${displayLabel}**.`, ephemeral: true });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas ustawiania celu: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas ustawiania celu.', ephemeral: true });
            }
        }
    }

    async updateMaterialy(interaction, liczba) {
        const { client } = this;
        try {
            const { periodLabel, displayLabel } = getWarsawMonthRange(0);

            await MonthlyGoal.findOneAndUpdate(
                { guildId: interaction.guild.id, periodLabel },
                { $set: { aktualneMaterialy: liczba }, $setOnInsert: { setBy: interaction.user.id } },
                { upsert: true, new: true }
            );

            await interaction.reply({ content: `✅ Zaktualizowano liczbę materiałów na ${liczba} (${displayLabel}).`, ephemeral: true });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas aktualizacji materiałów: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas aktualizacji materiałów.', ephemeral: true });
            }
        }
    }

    async showGoal(interaction) {
        const { client } = this;
        try {
            const { periodLabel, displayLabel } = getWarsawMonthRange(0);
            const goal = await MonthlyGoal.findOne({ guildId: interaction.guild.id, periodLabel });

            if (!goal) {
                return interaction.reply({ content: `ℹ️ Nie ustawiono jeszcze celów na ${displayLabel}.`, ephemeral: true });
            }

            const { start, end } = getWarsawMonthRange(0);
            const { analystCounts, eventCount } = await this.getPeriodActivity(interaction.guild.id, start, end);
            const reportCount = [...analystCounts.values()].reduce((sum, n) => sum + n, 0);

            const totalTarget = goal.targetNagrywki + goal.targetRaporty + goal.targetMaterialy;
            const totalActual = eventCount + reportCount + goal.aktualneMaterialy;
            const realizacja = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

            const embed = new EmbedBuilder()
                .setTitle(`🎯 CELE MARKETINGU - ${displayLabel.toUpperCase()}`)
                .setColor('#e662eb')
                .setDescription(
                    `Nagrywki: ${eventCount} / ${goal.targetNagrywki}\n` +
                    `Raporty analityczne: ${reportCount} / ${goal.targetRaporty}\n` +
                    `Materiały: ${goal.aktualneMaterialy} / ${goal.targetMaterialy}\n\n` +
                    `Realizacja: **${realizacja}%**`
                );

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas pobierania celów: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas pobierania celów.', ephemeral: true });
            }
        }
    }

    async showLista(interaction, dzial, ranga) {
        const { client } = this;
        try {
            const query = { guildId: interaction.guild.id };
            if (dzial) query.dzial = dzial;
            if (ranga) query.ranga = ranga;

            const employees = await MarketingEmployee.find(query);

            if (!employees.length) {
                return interaction.reply({ content: 'ℹ️ Brak pracowników spełniających podane kryteria.', ephemeral: true });
            }

            const titleParts = [];
            if (dzial) titleParts.push(DZIAL_LABELS[dzial]);
            if (ranga) titleParts.push(RANGA_LABELS[ranga]);

            const lines = employees.map(e => {
                const bits = [`<@${e.userId}>`];
                if (!dzial && e.dzial) bits.push(DZIAL_LABELS[e.dzial]);
                if (!ranga && e.ranga) bits.push(RANGA_LABELS[e.ranga]);
                return `${bits.join(' - ')}`;
            });

            const embed = new EmbedBuilder()
                .setTitle(`👥 LISTA - ${titleParts.join(' / ') || 'Wszyscy pracownicy'}`)
                .setColor('#e662eb')
                .setDescription(lines.join('\n'));

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas pobierania listy: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas pobierania listy.', ephemeral: true });
            }
        }
    }

    async sendAnnouncement(interaction, channel, tresc) {
        const { client } = this;
        try {
            const embed = new EmbedBuilder()
                .setTitle('📢 Ogłoszenie Marketingu')
                .setColor('#e662eb')
                .setDescription(tresc)
                .setFooter({ text: `Wysłane przez ${interaction.user.tag}` })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            await interaction.reply({ content: `✅ Ogłoszenie zostało wysłane na ${channel}.`, ephemeral: true });
        } catch (error) {
            client.handler.logger.log('NORMAL', `Błąd podczas wysyłania ogłoszenia: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Nie udało się wysłać ogłoszenia (sprawdź uprawnienia bota na tym kanale).', ephemeral: true });
            }
        }
    }

    isMarketingAdmin(interaction) {
        const config = this.client.config.marketing;
        return !!(config && config.adminRole && interaction.member.roles.cache.has(config.adminRole));
    }

    async handleComponent(interaction) {
        if (!this.isMarketingAdmin(interaction)) {
            return interaction.reply({ content: '❌ Nie masz uprawnień do korzystania z tego panelu.', ephemeral: true });
        }

        const id = interaction.customId;

        if (interaction.isUserSelectMenu()) {
            if (id === 'mk_panel_pracownik_search') return this.showEmployeeManagePanel(interaction, interaction.values[0]);
            if (id === 'mk_frekwencja_search') return this.replyFrekwencjaFor(interaction, interaction.values[0]);
            if (id === 'mk_statystyki_search') return this.replyStatystykiFor(interaction, interaction.values[0]);
            return;
        }

        if (interaction.isStringSelectMenu()) {
            if (id.startsWith('mk_dzial_select_')) {
                return this.applyDzialFromComponent(interaction, id.replace('mk_dzial_select_', ''), interaction.values[0]);
            }
            if (id.startsWith('mk_ranga_select_')) {
                return this.applyRangaFromComponent(interaction, id.replace('mk_ranga_select_', ''), interaction.values[0]);
            }
            return;
        }

        if (interaction.isButton()) {
            if (id === 'mk_panel_manage') return this.promptEmployeeSearch(interaction);
            if (id === 'mk_panel_raport') return this.generateReport(interaction, 0);
            if (id === 'mk_panel_historia') return this.showHistory(interaction);
            if (id === 'mk_panel_cele') return this.showGoal(interaction);

            if (id.startsWith('mk_emp_dzial_')) return this.promptDzialSelect(interaction, id.replace('mk_emp_dzial_', ''));
            if (id.startsWith('mk_emp_ranga_')) return this.promptRangaSelect(interaction, id.replace('mk_emp_ranga_', ''));
            if (id.startsWith('mk_emp_notatka_')) return this.promptNotatkaModal(interaction, id.replace('mk_emp_notatka_', ''));
            if (id.startsWith('mk_emp_notatki_')) return this.listNotesButton(interaction, id.replace('mk_emp_notatki_', ''));
            if (id.startsWith('mk_emp_statystyki_')) return this.replyStatystykiFor(interaction, id.replace('mk_emp_statystyki_', ''));
            if (id.startsWith('mk_emp_frekwencja_')) return this.replyFrekwencjaFor(interaction, id.replace('mk_emp_frekwencja_', ''));
            if (id.startsWith('mk_emp_reset_confirm_')) return this.resetEmployeeFromComponent(interaction, id.replace('mk_emp_reset_confirm_', ''));
            if (id.startsWith('mk_emp_reset_')) return this.promptResetConfirm(interaction, id.replace('mk_emp_reset_', ''));
        }
    }

    async handleModalSubmit(interaction) {
        if (!this.isMarketingAdmin(interaction)) {
            return interaction.reply({ content: '❌ Nie masz uprawnień do tej akcji.', ephemeral: true });
        }

        const id = interaction.customId;

        if (id.startsWith('mk_notatka_modal_')) {
            const userId = id.replace('mk_notatka_modal_', '');
            const tresc = interaction.fields.getTextInputValue('tresc');

            try {
                await EmployeeNote.create({
                    guildId: interaction.guild.id,
                    targetUserId: userId,
                    authorId: interaction.user.id,
                    content: tresc
                });
                await interaction.reply({ content: `✅ Dodano notatkę dla <@${userId}>.`, ephemeral: true });
            } catch (error) {
                this.client.handler.logger.log('NORMAL', `Błąd podczas dodawania notatki (modal): ${error.message}`);
                await interaction.reply({ content: '❌ Wystąpił błąd podczas dodawania notatki.', ephemeral: true });
            }
        }
    }

    async promptEmployeeSearch(interaction) {
        const row = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('mk_panel_pracownik_search')
                .setPlaceholder('Wybierz pracownika...')
                .setMinValues(1)
                .setMaxValues(1)
        );

        await interaction.reply({ content: '👤 Wybierz pracownika, którym chcesz zarządzać:', components: [row], ephemeral: true });
    }

    async showEmployeeManagePanel(interaction, userId) {
        try {
            const employee = await MarketingEmployee.findOne({ guildId: interaction.guild.id, userId });

            const embed = new EmbedBuilder()
                .setTitle('👤 Zarządzanie pracownikiem')
                .setColor('#e662eb')
                .addFields(
                    { name: 'Pracownik', value: `<@${userId}>`, inline: true },
                    { name: 'Dział', value: employee?.dzial ? DZIAL_LABELS[employee.dzial] : 'Brak', inline: true },
                    { name: 'Ranga', value: employee?.ranga ? RANGA_LABELS[employee.ranga] : 'Brak', inline: true }
                );

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`mk_emp_dzial_${userId}`).setLabel('🏷️ Zmień dział').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`mk_emp_ranga_${userId}`).setLabel('⭐ Zmień rangę').setStyle(ButtonStyle.Primary)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`mk_emp_notatka_${userId}`).setLabel('📝 Dodaj notatkę').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mk_emp_notatki_${userId}`).setLabel('📖 Notatki').setStyle(ButtonStyle.Secondary)
            );
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`mk_emp_statystyki_${userId}`).setLabel('📊 Statystyki').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mk_emp_frekwencja_${userId}`).setLabel('📈 Frekwencja').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mk_emp_reset_${userId}`).setLabel('🔁 Resetuj').setStyle(ButtonStyle.Danger)
            );

            await interaction.update({ content: null, embeds: [embed], components: [row1, row2, row3] });
        } catch (error) {
            this.client.handler.logger.log('NORMAL', `Błąd panelu zarządzania pracownikiem: ${error.message}`);
        }
    }

    async promptDzialSelect(interaction, userId) {
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`mk_dzial_select_${userId}`)
                .setPlaceholder('Wybierz dział...')
                .addOptions(
                    { label: '🎥 Nagrywający', value: 'nagrywajacy' },
                    { label: '📊 Analityk', value: 'analityk' },
                    { label: '🎭 Aktor', value: 'aktor' }
                )
        );

        await interaction.reply({ content: `Wybierz nowy dział dla <@${userId}>:`, components: [row], ephemeral: true });
    }

    async promptRangaSelect(interaction, userId) {
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`mk_ranga_select_${userId}`)
                .setPlaceholder('Wybierz rangę...')
                .addOptions(
                    { label: '🟢 Junior', value: 'junior' },
                    { label: '🔵 Regular', value: 'regular' },
                    { label: '🟣 Senior', value: 'senior' }
                )
        );

        await interaction.reply({ content: `Wybierz nową rangę dla <@${userId}>:`, components: [row], ephemeral: true });
    }

    async applyDzialFromComponent(interaction, userId, dzial) {
        try {
            const roleWarning = await this._applyDzial(interaction.guild, userId, dzial);
            await interaction.update({
                content: `✅ Ustawiono dział ${DZIAL_LABELS[dzial]} dla <@${userId}>.${roleWarning}`,
                components: []
            });
        } catch (error) {
            this.client.handler.logger.log('NORMAL', `Błąd podczas ustawiania działu (panel): ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas ustawiania działu.', ephemeral: true });
            }
        }
    }

    async applyRangaFromComponent(interaction, userId, ranga) {
        try {
            const roleWarning = await this._applyRanga(interaction.guild, userId, ranga);
            await interaction.update({
                content: `✅ Ustawiono rangę ${RANGA_LABELS[ranga]} dla <@${userId}>.${roleWarning}`,
                components: []
            });
        } catch (error) {
            this.client.handler.logger.log('NORMAL', `Błąd podczas ustawiania rangi (panel): ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Wystąpił błąd podczas ustawiania rangi.', ephemeral: true });
            }
        }
    }

    async promptNotatkaModal(interaction, userId) {
        const modal = new ModalBuilder().setCustomId(`mk_notatka_modal_${userId}`).setTitle('Dodaj notatkę');

        const input = new TextInputBuilder()
            .setCustomId('tresc')
            .setLabel('Treść notatki')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    async listNotesButton(interaction, userId) {
        const user = await this.client.users.fetch(userId).catch(() => null);
        if (!user) return interaction.reply({ content: '❌ Nie znaleziono użytkownika.', ephemeral: true });
        return this.listNotes(interaction, user);
    }

    async replyStatystykiFor(interaction, userId) {
        const user = await this.client.users.fetch(userId).catch(() => null);
        if (!user) return interaction.reply({ content: '❌ Nie znaleziono użytkownika.', ephemeral: true });
        return this.showStatystyki(interaction, user);
    }

    async replyFrekwencjaFor(interaction, userId) {
        const user = await this.client.users.fetch(userId).catch(() => null);
        if (!user) return interaction.reply({ content: '❌ Nie znaleziono użytkownika.', ephemeral: true });
        return this.showFrekwencja(interaction, user);
    }

    async promptResetConfirm(interaction, userId) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mk_emp_reset_confirm_${userId}`).setLabel('⚠️ Potwierdź reset').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            content: `Na pewno zresetować dział, rangę i zgłoszenia analityczne <@${userId}>? Tej operacji nie można cofnąć.`,
            components: [row],
            ephemeral: true
        });
    }

    async resetEmployeeFromComponent(interaction, userId) {
        const user = await this.client.users.fetch(userId).catch(() => null);
        if (!user) return interaction.reply({ content: '❌ Nie znaleziono użytkownika.', ephemeral: true });
        return this.resetEmployee(interaction, user);
    }

    async promptFrekwencjaSearch(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📈 FREKWENCJA')
            .setColor('#e662eb')
            .setDescription('Wybierz pracownika z listy poniżej, aby sprawdzić jego frekwencję.\n(Panel można używać wielokrotnie - wybieraj kolejnych pracowników.)');

        const row = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder().setCustomId('mk_frekwencja_search').setPlaceholder('Wybierz pracownika...').setMinValues(1).setMaxValues(1)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    }

    async promptStatystykiSearch(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📊 STATYSTYKI')
            .setColor('#e662eb')
            .setDescription('Wybierz pracownika z listy poniżej, aby zobaczyć jego statystyki.\n(Panel można używać wielokrotnie - wybieraj kolejnych pracowników.)');

        const row = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder().setCustomId('mk_statystyki_search').setPlaceholder('Wybierz pracownika...').setMinValues(1).setMaxValues(1)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    }

    formatFullDate(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}.${month}.${d.getFullYear()}`;
    }
}

module.exports = MarketingManager;
