import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = "E:\\BharatPP\\Data\\active_db.sqlite";

try {
    console.log(`Attempting to open database: ${DB_PATH}`);
    const db = new Database(DB_PATH, { timeout: 5000 });
    console.log('Successfully opened database.');
    const row = db.prepare('SELECT count(*) as count FROM store').get();
    console.log('Query result:', row);
    db.close();
    console.log('Closed database.');
} catch (e) {
    console.error('FAILED to open database:', e);
}
