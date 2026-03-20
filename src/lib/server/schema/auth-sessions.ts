import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { accounts } from './accounts';

export const authSessions = sqliteTable('auth_sessions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	accountId: integer('account_id')
		.notNull()
		.references(() => accounts.id),
	tokenHash: text('token_hash').notNull().unique(),
	expiresAt: text('expires_at').notNull(),
	revokedAt: text('revoked_at'),
	createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});