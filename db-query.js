const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cricket_project');
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const matchCol = db.collection('matches');
    const inningCol = db.collection('innings');
    
    const sampleMatch = await matchCol.findOne({});
    console.log('Match info:');
    if (sampleMatch) {
      console.log('  ID:', sampleMatch._id);
      console.log('  Status:', sampleMatch.status);
      console.log('  CurrentInning:', sampleMatch.currentInning);
      console.log('  TotalInnings:', sampleMatch.totalInnings);
      
      const matchInnings = await inningCol.find({ matchId: sampleMatch._id }).toArray();
      console.log(`\nInnings count for match ${sampleMatch._id}:`, matchInnings.length);
      matchInnings.forEach((inn, i) => {
        console.log(`  Inning ${i+1}: _id: ${inn._id}, inningNumber: ${inn.inningNumber}, battingTeamId: ${inn.battingTeamId}, totalRuns: ${inn.totalRuns}`);
      });
    } else {
      console.log('  No matches found.');
    }
  } catch (err) {
    console.error('Error running check:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
