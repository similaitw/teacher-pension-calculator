const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../pension-rules.js');
const {enumeratePensionScenarios}=require('../comparison-engine.js');

test('第 18 條：一般自願退休 60 歲，原住民降為 55 歲；滿 25 年不看年齡',()=>{
  assert.equal(rules.voluntaryRetirementAge(),60);
  assert.equal(rules.voluntaryRetirementAge({indigenous:true}),55);
  assert.equal(rules.isVoluntaryRetirementEligible({years:10,age:56}),false);
  assert.equal(rules.isVoluntaryRetirementEligible({years:10,age:56,indigenous:true}),true);
  assert.equal(rules.isVoluntaryRetirementEligible({years:4.9,age:61,indigenous:true}),false);
  assert.equal(rules.isVoluntaryRetirementEligible({years:25,age:48}),true);
});

test('特殊長期服務 81 基數／95% 只限本條例施行（107/7/1）前退休生效',()=>{
  assert.equal(rules.isBeforeActEffective(107,6),true);
  assert.equal(rules.isBeforeActEffective(107,7),false);
  assert.equal(rules.isBeforeActEffective(124,8),false);
});

test('核定總年資：資格按日不進位，給與畸零未滿一個月以一個月計',()=>{
  const exact=rules.certifiedTenureMonths({years:14,months:11,days:0});
  assert.equal(exact.eligibilityMonths,179);assert.equal(exact.benefitMonths,179);
  const fraction=rules.certifiedTenureMonths({years:14,months:11,days:20});
  assert.equal(fraction.eligibilityMonths,179);
  assert.equal(fraction.benefitMonths,180);
  assert.throws(()=>rules.certifiedTenureMonths({years:1,months:12}),RangeError);
  assert.throws(()=>rules.certifiedTenureMonths({years:1,days:31}),RangeError);
});

test('命令退休：一般命令退休須滿 5 年、不適用起支年齡',()=>{
  const voluntary=rules.orderedRetirementAdjustments();
  assert.equal(voluntary.ordered,false);assert.equal(voluntary.startAgeExempt,false);
  const ordered=rules.orderedRetirementAdjustments({cause:'ordered'});
  assert.equal(ordered.minServiceMonths,60);assert.equal(ordered.startAgeExempt,true);
  assert.equal(ordered.extraLumpBases,0);assert.equal(ordered.ceilingExempt,false);
});

test('因公命令退休：年資保障、執行職務加發基數與所得上限排除',()=>{
  const execution=rules.orderedRetirementAdjustments({cause:'ordered-duty',dutyType:'execution',disability:'half'});
  assert.equal(execution.minServiceMonths,0);
  assert.equal(execution.lumpFloorMonths,60);
  assert.equal(execution.monthlyFloorMonths,240);
  assert.equal(execution.extraLumpBases,5);
  assert.equal(execution.ceilingExempt,true);
  assert.equal(rules.orderedRetirementAdjustments({cause:'ordered-duty',dutyType:'execution',disability:'full-dependent'}).extraLumpBases,15);
  const other=rules.orderedRetirementAdjustments({cause:'ordered-duty',dutyType:'other',disability:'full-selfcare'});
  assert.equal(other.extraLumpBases,0);assert.equal(other.ceilingExempt,false);
  assert.equal(rules.orderedRetirementAdjustments({cause:'ordered-duty',dutyType:'other',disability:'full-dependent'}).ceilingExempt,true);
  assert.throws(()=>rules.orderedRetirementAdjustments({cause:'early'}),RangeError);
});

test('不適用所得上限時，基金制月退取法定公式且混合制不扣減',()=>{
  const capped=rules.calculateFundPension({years:35,averageSalary:60000,finalSalary:40000});
  const exempt=rules.calculateFundPension({years:35,averageSalary:60000,finalSalary:40000,ceilingExempt:true});
  assert.ok(capped.monthly<capped.statutoryMonthly);
  assert.equal(exempt.monthly,exempt.statutoryMonthly);
  const ceiling=rules.applyIncomeReplacementCeiling({preferentialInterest:20000,legacyMonthly:40000,fundMonthly:30000,finalSalary:50000,totalCreditedMonths:420,exempt:true});
  assert.equal(ceiling.deductions.total,0);assert.equal(ceiling.after.total,90000);
});

test('命令退休方案比較只列退休生效日起支，不列減額或展期',()=>{
  const scenarios=enumeratePensionScenarios({retirementAge:50,years:20,benefits:{lump:{lump:100},half:{lump:50,monthly:5},monthly:{monthly:10}},selectedType:'monthly',selectedMode:'ordered',ordered:true});
  assert.deepEqual(scenarios.map(s=>s.id),['lump-ordered','half-ordered','monthly-ordered']);
  assert.ok(scenarios.every(s=>s.startAge===50));
  assert.equal(scenarios.find(s=>s.selected).id,'monthly-ordered');
});
