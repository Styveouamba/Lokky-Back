const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

async function clearLeaderboardCache() {
  try {
    console.log('🔄 Clearing leaderboard cache...');
    
    const keys = await redis.keys('leaderboard:*');
    console.log(`Found ${keys.length} cache keys:`, keys);
    
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log('✅ Cache cleared successfully!');
    } else {
      console.log('ℹ️  No cache keys found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    process.exit(1);
  }
}

clearLeaderboardCache();
