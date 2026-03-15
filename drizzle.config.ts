import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL ?? 'file:data/meeting-note.db';

export default defineConfig({
	schema: './src/lib/server/schema/*.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: databaseUrl
	}
});