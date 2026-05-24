const mongoose = require('mongoose');

async function dropIndex() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cricket_project');
    const db = mongoose.connection.db;
    
    try {
      await db.collection('rankings').dropIndex('playerId_1_type_1_gender_1_format_1_role_1');
      console.log('Dropped playerId index');
    } catch(e) {
      console.error('Could not drop playerId index:', e.message);
    }

    try {
      await db.collection('rankings').dropIndex('teamId_1_type_1_gender_1_format_1_role_1');
      console.log('Dropped teamId index');
    } catch(e) {
      console.error('Could not drop teamId index:', e.message);
    }
    
    // Drop all indexes just to be safe so Mongoose rebuilds them correctly based on the new schema
    try {
      await db.collection('rankings').dropIndexes();
      console.log('Dropped all indexes successfully. Mongoose will rebuild the correct ones.');
    } catch (e) {
      console.error('Could not drop all indexes:', e.message);
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
dropIndex();
