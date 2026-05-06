const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = 'd:\\ILCBala\\PMS\\BPP\\Data\\active_db.sqlite';
const dir = path.dirname(dbPath);

if (!fs.existsSync(dir)) {
    console.log('Creating directory...');
    fs.mkdirSync(dir, { recursive: true });
}

try {
    console.log('Opening database at', dbPath);
    const db = new Database(dbPath);
    console.log('Database opened successfully.');
    db.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
    console.log('Table created.');
    db.close();
    console.log('Database closed.');
} catch (e) {
    console.error('Error:', e);
}
