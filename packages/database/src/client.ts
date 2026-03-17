import { PrismaClient } from './generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

let prismaInstance: PrismaClient | undefined;

/** Prisma MariaDB adapter expects scheme mariadb:// (not mysql://) */
function getDatabaseUrl(): string {
  let url: string;
  if (process.env.DATABASE_URL) {
    url = process.env.DATABASE_URL;
  } else {
    const host = process.env.MYSQL_HOST || 'localhost';
    const port = process.env.MYSQL_PORT || '3306';
    const user = process.env.MYSQL_USER || 'solopay';
    const password = process.env.MYSQL_PASSWORD || '';
    const database = process.env.MYSQL_DATABASE || 'solopay';
    url = `mysql://${user}:${password}@${host}:${port}/${database}`;
  }
  url = url.replace(/^mysql:\/\//i, 'mariadb://');

  // Default connectionLimit to 2 if not specified in URL
  const parsed = new URL(url);
  if (!parsed.searchParams.has('connectionLimit')) {
    parsed.searchParams.set('connectionLimit', '2');
  }
  return parsed.toString();
}

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '2', 10);
    const adapter = new PrismaMariaDb(getDatabaseUrl(), { connectionLimit });
    prismaInstance = new PrismaClient({ adapter });
  }
  return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = undefined;
  }
}
