import { MongoClient } from 'mongodb';

async function checkUser() {
  const uri = 'mongodb://localhost:27017/gdht'; // Adjusted based on common local setups
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('gdht');
    const users = database.collection('users');

    const user = await users.findOne({ fullName: 'Dinh' });
    console.log('User found:', JSON.stringify(user, null, 2));
    
    const user2 = await users.findOne({ fullName: 'Dinh dep traisss' });
    console.log('User 2 found:', JSON.stringify(user2, null, 2));

  } finally {
    await client.close();
  }
}

checkUser().catch(console.error);
