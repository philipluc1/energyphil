// node lib/gasPlans.test.mjs — checks the stepped-rate maths.
import assert from "node:assert/strict";
function computeGasBill(plan, u) {
  const [, , , , supply, blocks, perDay] = plan;
  // Mirrors lib/gasPlans.ts: each block's upTo is its SIZE, so blocks stack (7 Nov 2026).
  let remaining = u.mj, variable = 0;
  for (const b of blocks) {
    const cap = b.upTo === null ? Infinity : perDay ? b.upTo * u.days : b.upTo;
    const take = Math.max(0, Math.min(remaining, cap));
    variable += take * b.rate; remaining -= take;
    if (remaining <= 0) break;
  }
  if (remaining > 0) variable += remaining * blocks[blocks.length - 1].rate;
  return supply * u.days + variable;
}
// 90 days, 50 MJ/day = 4500 MJ; blocks: first 50/day @ 0.04, rest @ 0.03
const p = ["R","Z","P","MARKET",0.8,[{upTo:50,rate:0.04},{upTo:null,rate:0.03}],true];
assert.equal(computeGasBill(p,{days:90,mj:4500}).toFixed(2), (72+4500*0.04).toFixed(2));
assert.equal(computeGasBill(p,{days:90,mj:6000}).toFixed(2), (72+4500*0.04+1500*0.03).toFixed(2));
// Per period: first 1000 MJ, the NEXT 3000 (so up to 4000), then the rest.
const q = ["R","Z","P","MARKET",0.8,[{upTo:1000,rate:0.05},{upTo:3000,rate:0.04},{upTo:null,rate:0.03}],false];
assert.equal(computeGasBill(q,{days:90,mj:4500}).toFixed(2), (72+1000*0.05+3000*0.04+500*0.03).toFixed(2));
// AGN's real shape, 27.4 then 21.9 MJ a day: 30 MJ a day for 90 days lands 2.6/day in the second block.
const agn = ["R","Australian Gas Networks","P","MARKET",0.8,[{upTo:27.4,rate:0.04},{upTo:21.9,rate:0.03},{upTo:null,rate:0.02}],true];
assert.equal(computeGasBill(agn,{days:90,mj:2700}).toFixed(2), (72+27.4*90*0.04+2.6*90*0.03).toFixed(2));
console.log("gas maths ok");
