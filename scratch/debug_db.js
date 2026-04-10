import Database from 'better-sqlite3';
import path from 'path';

const dbPath = "E:\\BharatPP\\Data\\active_db.sqlite";
console.log(`Connecting to: ${dbPath}`);

try {
    const db = new Database(dbPath, { verbose: console.log });
    console.log("Connection successful!");
    const version = db.prepare('SELECT sqlite_version() as version').get();
    console.log("SQLite Version:", version);
    db.close();
} catch (e) {
    console.error("Connection FAILED!");
    console.error(e);
}
