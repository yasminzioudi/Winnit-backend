import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { createConnection } from 'mongoose';
import { ensureIndexes } from '../src/database/ensure-indexes';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/winnit';

async function createIndexes() {
  const connection = createConnection(MONGODB_URI);

  try {
    await connection.asPromise();
    console.log('Creating indexes...');

    await ensureIndexes(connection);

    console.log('\n✅ All indexes created successfully!');
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  } finally {
    await connection.close();
  }
}

createIndexes();
