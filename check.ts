import fs from 'fs';
const content = fs.readFileSync('index.html', 'utf8');
const items = {
  'ec01v40': 18900,
  'ec01105': 15900,
  'ec01001': 1390,
  'ec01002': 3190,
  'ec01003': 1590,
  'ec01004': 3390,
  'ec01006': 1490,
  'ec01007': 3690,
  'ec01008': 2990,
  'ec01009': 3590,
  'ec01012': 590,
  'ec01013': 1490,
  'ec01014': 3690,
  'ec01015': 1490,
  'ec01016': 1190,
  'ec01016-1': 1790,
  'ec01017': 3690,
  'ec01025': 11490,
  'ec01026': 1390,
  'ec01028': 1990,
  'ec01030': 3190,
  'ec01031': 290,
  'ec01037': 890,
  'ec01041': 3490,
  'ec01043': 2990,
  'ec01056': 4490,
  'ec01060': 15990,
  'ec01064': 4990,
  'ec01079': 4590,
  'ec01090': 16990,
  'ec01101': 16990,
  'ec01124': 150
};

let mismatches = [];
for (const [id, expectedPrice] of Object.entries(items)) {
  const regex = new RegExp(`id:\\s*'${id}'.*?price:\\s*(\\d+)`);
  const match = content.match(regex);
  if (match) {
    const actualPrice = parseInt(match[1], 10);
    if (actualPrice !== expectedPrice) {
      mismatches.push(`${id}: expected ${expectedPrice}, found ${actualPrice}`);
    }
  } else {
    mismatches.push(`${id}: not found in index.html`);
  }
}

if (mismatches.length > 0) {
  console.log('Mismatches found:');
  console.log(mismatches.join('\n'));
} else {
  console.log('All prices match the expected values.');
}
