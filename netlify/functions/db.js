const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/yourdb';

// 连接选项（优化连接性能）
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // 连接池大小
  serverSelectionTimeoutMS: 5000 // 连接超时时间
};

// 缓存连接实例
let dbInstance = null;

async function getDb() {
  if (dbInstance) return dbInstance;
  
  try {
    await mongoose.connect(MONGO_URI, options);
    dbInstance = mongoose.connection;
    console.log('Database connected successfully');
    
    // 监听连接错误
    dbInstance.on('error', (err) => {
      console.error('Database connection error:', err);
      dbInstance = null; // 连接错误时重置实例
    });
    
    return dbInstance;
  } catch (err) {
    console.error('Failed to connect to database:', err);
    throw err;
  }
}

module.exports = { getDb };