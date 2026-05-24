const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cricket_project');
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const matchCol = db.collection('matches');
    
    const sampleMatch = await matchCol.findOne({});
    console.log('Full Match Document:');
    console.log(JSON.stringify(sampleMatch, null, 2));
    
  } catch (err) {
    console.error('Error running check:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
