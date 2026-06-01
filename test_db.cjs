const DB = require('better-sqlite3');
const db = new DB('E:/BharatPP_Dev/BharatPP/Data/NKEFLO_473748/active_db.sqlite');
const row = db.prepare('SELECT value FROM store WHERE key = ?').get('app_payroll_history_FY26-27_NKEFLO_473748');
if (row) {
    let parsed = JSON.parse(row.value);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    console.log('Total records:', parsed.length);
    if (parsed.length > 0) {
        let minYear = 9999;
        let maxYear = 0;
        let months = new Set();
        parsed.forEach(r => {
            if (r.year < minYear) minYear = r.year;
            if (r.year > maxYear) maxYear = r.year;
            months.add(r.month);
        });
        console.log('Years spanning:', minYear, 'to', maxYear);
        console.log('Months present:', Array.from(months).join(', '));
    }
}
