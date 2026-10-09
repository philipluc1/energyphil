// node lib/gasPlans.test.mjs — checks the stepped-rate maths.
import assert from "node:assert/strict";
function computeGasBill(plan, u) {
  const [, , , , supply, blocks, perDay] = plan;
  let remaining = u.mj, variable = 0, prev = 0;
  for (const b of blocks) {
    const cap = b.upTo === null ? Infinity : (perDay ? b.upTo * u.days : b.upTo) - prev;
    const take = Math.max(0, Math.min(remaining, cap));
    variable += take * b.rate; remaining -= take;
    if (b.upTo !== null) prev = perDay ? b.upTo * u.days : b.upTo;
    if (remaining <= 0) break;
  }
  if (remaining > 0) variable += remaining * blocks[blocks.length - 1].rate;
  return supply * u.days + variable;
}
// 90 days, 50 MJ/day = 4500 MJ; blocks: first 50/day @ 0.04, rest @ 0.03
const p = ["R","Z","P","MARKET",0.8,[{upTo:50,rate:0.04},{upTo:null,rate:0.03}],true];
assert.equal(computeGasBill(p,{days:90,mj:4500}).toFixed(2), (72+4500*0.04).toFixed(2));
assert.equal(computeGasBill(p,{days:90,mj:6000}).toFixed(2), (72+4500*0.04+1500*0.03).toFixed(2));
const q = ["R","Z","P","MARKET",0.8,[{upTo:1000,rate:0.05},{upTo:3000,rate:0.04},{upTo:null,rate:0.03}],false];
assert.equal(computeGasBill(q,{days:90,mj:4500}).toFixed(2), (72+1000*0.05+2000*0.04+1500*0.03).toFixed(2));
console.log("gas maths ok");
