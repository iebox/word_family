import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'wf',
  password: 'wf1234ASDFASdfasldf2934@{}#+af3',
  database: 'wf',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool: mysql.Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

export async function query<T = any>(sql: string, values?: any[]): Promise<T[]> {
  const connection = await getPool().getConnection();
  try {
    const [rows] = await connection.execute(sql, values);
    return rows as T[];
  } finally {
    connection.release();
  }
}
