import { MongoClient, ObjectId } from 'mongodb';

async function syncAssignments() {
  const uri = 'mongodb://localhost:27017/gdht'; // Thay đổi nếu URI khác
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    const classesCollection = db.collection('classes');
    const lessonsCollection = db.collection('lessons');
    const categoriesCollection = db.collection('categories');

    const classes = await classesCollection.find({}).toArray();

    console.log(`Checking ${classes.length} classes for assignments...`);

    for (const cls of classes) {
      const classId = cls._id;

      // Sync Lessons
      if (cls.assignedLessons && cls.assignedLessons.length > 0) {
        const lessonIds = cls.assignedLessons.map(id => new ObjectId(id));
        await lessonsCollection.updateMany(
          { _id: { $in: lessonIds } },
          { $addToSet: { targetClassIds: classId } }
        );
        console.log(`Synced ${lessonIds.length} lessons for class: ${cls.name}`);
      }

      // Sync Categories
      if (cls.assignedCategories && cls.assignedCategories.length > 0) {
        const categoryIds = cls.assignedCategories.map(id => new ObjectId(id));
        await categoriesCollection.updateMany(
          { _id: { $in: categoryIds } },
          { $addToSet: { targetClassIds: classId } }
        );
        console.log(`Synced ${categoryIds.length} categories for class: ${cls.name}`);
      }
    }

    console.log('Sync completed successfully!');
  } catch (err) {
    console.error('Error during sync:', err);
  } finally {
    await client.close();
  }
}

syncAssignments();
