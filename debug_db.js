const mongoose = require('mongoose');

async function checkLessons() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gdht');
  
  const LessonSchema = new mongoose.Schema({}, { strict: false });
  const Lesson = mongoose.model('Lesson', LessonSchema);
  
  const CategorySchema = new mongoose.Schema({}, { strict: false });
  const Category = mongoose.model('Category', CategorySchema);

  const lessons = await Lesson.find({}).exec();
  const categories = await Category.find({}).exec();

  console.log('--- CATEGORIES ---');
  categories.forEach(c => {
    console.log(`ID: ${c._id}, Name: "${c.name}"`);
  });

  console.log('\n--- LESSONS ---');
  lessons.forEach(l => {
    console.log(`Title: "${l.title}", Category: "${l.category}", CategoryID: ${l.categoryId}`);
  });

  await mongoose.disconnect();
}

checkLessons().catch(console.error);
