const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cricket_project?replicaSet=rs0');
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const scoreHistoryCol = db.collection('scorehistories');
    
    const matchId = new mongoose.Types.ObjectId('699165d6dbdec19ac4cab9df');
    
    const wicketHist = await scoreHistoryCol.findOne({
      matchId,
      $or: [
        { 'event.type': 'WICKET' },
        { 'event.isWicket': true },
        { isWicket: true }
      ]
    });
    
    if (wicketHist) {
      console.log('--- Wicket Score History Event Keys ---', Object.keys(wicketHist.event || {}));
      console.log('type:', wicketHist.event?.type);
      console.log('runs:', wicketHist.event?.runs);
      console.log('isWicket:', wicketHist.event?.isWicket);
      console.log('event detail:', JSON.stringify(wicketHist.event, null, 2));
    } else {
      console.log('No wicket score history found');
    }

  } catch (err) {
    console.error('Error running check:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();




