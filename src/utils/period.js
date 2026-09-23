const MONTH_NAMES_PL = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

function getTimezoneOffsetMinutes(timeZone, date) {
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

function getWarsawParts(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Warsaw',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});

    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function warsawMidnightUtc(year, month, day) {
    const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const offsetMinutes = getTimezoneOffsetMinutes('Europe/Warsaw', guess);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60000);
}

function getWarsawMonthRange(monthsAgo = 0, refDate = new Date()) {
    const nowParts = getWarsawParts(refDate);

    let year = nowParts.year;
    let month = nowParts.month - monthsAgo;

    while (month <= 0) {
        month += 12;
        year -= 1;
    }
    while (month > 12) {
        month -= 12;
        year += 1;
    }

    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
    }

    const start = warsawMidnightUtc(year, month, 1);
    const end = warsawMidnightUtc(nextYear, nextMonth, 1);

    return {
        start,
        end,
        year,
        month,
        periodLabel: `${year}-${String(month).padStart(2, '0')}`,
        displayLabel: `${MONTH_NAMES_PL[month - 1]} ${year}`
    };
}

function daysRemainingInMonth(refDate = new Date()) {
    const parts = getWarsawParts(refDate);
    const daysInMonth = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
    return daysInMonth - parts.day;
}

module.exports = { getWarsawMonthRange, getWarsawParts, daysRemainingInMonth, MONTH_NAMES_PL };
