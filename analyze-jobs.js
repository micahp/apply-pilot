#!/usr/bin/env node
const jobs = require('./jobs.json');

console.log(`Total jobs: ${jobs.length}`);

// By source/company
const bySource = {};
jobs.forEach(j => { bySource[j.source] = (bySource[j.source] || 0) + 1; });
console.log('\nBy source (top company):');
Object.entries(bySource).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

// Score distribution
const scores = jobs.map(j => j.score || 0).sort((a,b) => b-a);
console.log(`\nScore range: ${scores[scores.length-1]} - ${scores[0]}`);

// Score buckets
console.log('Score buckets:');
for (let bucket = 100; bucket >= 0; bucket -= 10) {
  const count = scores.filter(s => s >= bucket && s < bucket + 10).length;
  if (count > 0) console.log(`  ${bucket}-${bucket+9}: ${count}`);
}

// Top 30 by score, distinct companies shown
console.log('\n\nTop 30 AI/LLM jobs by relevance:');
console.log('================================\n');
let count = 0;
for (const j of jobs.sort((a,b) => (b.score||0) - (a.score||0))) {
  count++;
  const bar = '█'.repeat(Math.round((j.score||0)/10));
  console.log(`${count.toString().padStart(3)}. [${j.score}] ${bar.padEnd(10)} ${j.title}`);
  console.log(`     ${j.company} — ${j.location || 'Remote'}`);
  console.log(`     ${j.url}`);
  console.log();
  if (count >= 30) break;
}

// Count US/remote jobs with high relevance (score >= 40)
const usRemote = jobs.filter(j => {
  const loc = (j.location || '').toLowerCase();
  return j.score >= 40 && (
    loc.includes('remote') ||
    loc.includes('san francisco') || loc.includes('sf') || loc.includes('bay area') ||
    loc.includes('new york') || loc.includes('ny') || loc.includes('nyc') ||
    loc.includes('palo alto') || loc.includes('seattle') ||
    loc.includes('united states') || loc.includes('usa') ||
    loc.includes('austin') || loc.includes('los angeles') || loc.includes('boston') ||
    loc.includes('denver') || loc.includes('chicago') || loc.includes('dc') ||
    loc.includes('mountain view') || loc.includes('menlo park')
  );
});
console.log(`\nUS/Remote jobs (score >= 40): ${usRemote.length}`);
