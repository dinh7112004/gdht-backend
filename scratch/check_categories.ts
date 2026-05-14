import { MongoClient } from 'mongodb';

async function checkCategories() {
  const uri = 'mongodb://localhost:27017/gdht';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('gdht');
    const categories = database.collection('categories');

    const all = await categories.find({}).toArray();
    console.log('--- ALL CATEGORIES ---');
    all.forEach(c => {
      console.log(`Name: ${c.name}, CreatorId: ${c.creatorId}, id: ${c._id}`);
    });

  } finally {
    await client.close();
  }
}

checkCategories().catch(console.error);
