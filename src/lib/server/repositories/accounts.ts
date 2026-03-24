import { count, desc, eq, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { accounts, type AccountRole } from '$lib/server/schema/accounts';

export type AccountRow = typeof accounts.$inferSelect;

export async function insertAccount(values: {
	email: string;
	name: string;
	passwordHash: string;
	role: AccountRole;
	isOwner: boolean;
	isActive: boolean;
}): Promise<AccountRow> {
	const [insertedRow] = await db.insert(accounts).values(values).returning();

	if (!insertedRow) {
		throw new Error('Unable to retrieve created account');
	}

	return insertedRow;
}

export function findAccountByEmail(email: string): Promise<AccountRow | undefined> {
	return db
		.select()
		.from(accounts)
		.where(eq(accounts.email, email))
		.limit(1)
		.then(([account]) => account);
}

export function findAccountById(id: number): Promise<AccountRow | undefined> {
	return db
		.select()
		.from(accounts)
		.where(eq(accounts.id, id))
		.limit(1)
		.then(([account]) => account);
}

export async function countOwnerAccounts(): Promise<number> {
	const [result] = await db
		.select({ count: count() })
		.from(accounts)
		.where(eq(accounts.isOwner, true));
	return result?.count ?? 0;
}

export function listAccountRows(): Promise<AccountRow[]> {
	return db.select().from(accounts).orderBy(desc(accounts.createdAt), desc(accounts.id));
}

export async function updateAccountActiveState(id: number, isActive: boolean): Promise<AccountRow> {
	const [updatedRow] = await db
		.update(accounts)
		.set({
			isActive,
			updatedAt: sql`CURRENT_TIMESTAMP`
		})
		.where(eq(accounts.id, id))
		.returning();

	if (!updatedRow) {
		throw new Error('Unable to update account status');
	}

	return updatedRow;
}