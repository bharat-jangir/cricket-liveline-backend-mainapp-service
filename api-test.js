async function test() {
  try {
    const url = 'http://localhost:5000/api/app/matches/699165d6dbdec19ac4cab9df/live-status';
    console.log('Fetching live-status from:', url);
    const res = await fetch(url);
    console.log('Status Code:', res.status);
    const data = await res.json();
    const result = data?.data?.result ?? data?.result ?? data?.data ?? data;
    console.log('Result Keys:', Object.keys(result));
    console.log('Innings Count:', result.innings?.length);
    if (result.innings) {
      result.innings.forEach((inn, i) => {
        console.log(`  Innings ${i+1}: _id: ${inn._id}, inningNumber: ${inn.inningNumber}, totalRuns: ${inn.totalRuns}`);
      });
    }
  } catch (err) {
    console.error('Error fetching live status:', err.message);
  }
}

test();
