import { dbPool } from "../config/db.js";

export async function getStats() {
  const [userCount, mediaCount] = await Promise.all([
    dbPool.query(`SELECT COUNT(*) FROM "user"`),
    dbPool.query(`SELECT COUNT(*) FROM media`),
  ]);

  return {
    totalUsers: Number(userCount.rows[0].count),
    totalPhotos: Number(mediaCount.rows[0].count),
  };
}

export async function getStatsCharts() {
  const growthResult = await dbPool.query(`
    SELECT
      TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
      COUNT(*) AS users
    FROM "user"
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
    ORDER BY date
  `);

  const roleResult = await dbPool.query(`
    SELECT role, COUNT(*) AS count
    FROM "user"
    GROUP BY role
  `);

  return {
    growth: growthResult.rows.map((r) => ({
      date: r.date,
      users: Number(r.users),
    })),
    roleDistribution: roleResult.rows.map((r) => ({
      role: r.role,
      count: Number(r.count),
    })),
  };
}

export async function deleteUser(userId, currentUserId) {
  if (!userId) {
    const err = new Error("User ID is required");
    err.status = 400;
    throw err;
  }

  if (currentUserId && userId === currentUserId) {
    const err = new Error("Cannot delete your own account");
    err.status = 400;
    throw err;
  }

  const result = await dbPool.query(`DELETE FROM "user" WHERE id = $1`, [
    userId,
  ]);

  if (result.rowCount === 0) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  return { success: true };
}
