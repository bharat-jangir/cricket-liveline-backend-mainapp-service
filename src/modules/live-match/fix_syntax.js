const fs = require('fs');
const path = 'f:\\coding\\Cricket Project\\cricket-backend\\main-app\\src\\modules\\live-match\\live-match.service.ts';
let content = fs.readFileSync(path, 'utf8');

// The problematic block has a dangling } at 967 and missing if before 962
const problematic = `\n          await this.inningModel.findOneAndUpdate(\r\n            { matchId: matchObjectId, inningNumber: currentInningNum },\r\n            { $set: inningUpdate },\r\n            { session: s, upsert: true }\r\n          );\r\n        }`;

const fixed = `\n        if (Object.keys(inningUpdate).length > 0) {\n          await this.inningModel.findOneAndUpdate(\n            { matchId: matchObjectId, inningNumber: currentInningNum },\n            { $set: inningUpdate },\n            { session: s, upsert: true }\n          );\n        }`;

// Try a more flexible replacement if exact match fails
if (!content.includes(problematic)) {
    console.log('Exact match failed, trying regex match...');
    const regex = /await this\.inningModel\.findOneAndUpdate\([\s\S]*?\)\;[\s\n\r]*\}/;
    content = content.replace(regex, (match) => {
        if (match.includes('if (Object.keys(inningUpdate).length > 0)')) return match; // Already fixed
        return `if (Object.keys(inningUpdate).length > 0) {\n  ${match}`;
    });
} else {
    content = content.replace(problematic, fixed);
}

fs.writeFileSync(path, content, 'utf8');
console.log('File patched successfully.');
