import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { migrate } from 'drizzle-orm/libsql/migrator';

import { databaseFilePath, db } from '../src/lib/server/db.js';

async function run(): Promise<void> {
	await mkdir(dirname(resolve(process.cwd(), databaseFilePath)), { recursive: true });
	await migrate(db, { migrationsFolder: 'drizzle' });
}

run().catch((error) => {
	console.error(error);
	process.exit(1);
});