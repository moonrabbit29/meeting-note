import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

const databaseFilePath = 'data/meeting-note.db';
const databaseUrl = process.env.DATABASE_URL ?? `file:${databaseFilePath}`;

export const libsqlClient = createClient({ url: databaseUrl });
export const db = drizzle(libsqlClient);
export { databaseFilePath };