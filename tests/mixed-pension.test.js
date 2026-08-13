const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../pension-rules.js');

function closeTo(actual,expected,message){
  assert.ok(Math.abs(actual-expected)<1e-8,message||`${actual} should equal ${expected}`);
}

test('基金制分項依合計年資在 35 年前後使用 2% 與 1%',()=>{
  const at35=rules.fundComponentRates(20*12,15*12);
  closeTo(at35.monthlyRate,.40);
  closeTo(at35.lumpBases,30.5);
  const at40=rules.fundComponentRates(25*12,15*12);
  closeTo(at40.monthlyRate,.45);
  closeTo(at40.lumpBases,35.5);
});

test('月退年資最高採計 40 年並列出所有合法取捨',()=>{
  const choices=rules.enumerateServiceSelections({legacyMonths:30*12,fundMonths:12*12,benefitType:'monthly'});
  assert.equal(choices.length,25);
  assert.deepEqual(choices[0],{legacyMonths:28*12,fundMonths:12*12,totalMonths:40*12,droppedLegacyMonths:24,droppedFundMonths:0});
  assert.deepEqual(choices.at(-1),{legacyMonths:30*12,fundMonths:10*12,totalMonths:40*12,droppedLegacyMonths:0,droppedFundMonths:24});
});

test('一次退年資最高 42 年且舊制不得超過 30 年',()=>{
  const choices=rules.enumerateServiceSelections({legacyMonths:31*12,fundMonths:12*12+1,benefitType:'lump'});
  assert.ok(choices.every(x=>x.totalMonths===42*12));
  assert.ok(choices.every(x=>x.legacyMonths<=30*12));
  assert.ok(choices.some(x=>x.legacyMonths===30*12&&x.fundMonths===12*12));
});

test('未超過上限時只產生原始年資組合',()=>{
  const choices=rules.enumerateServiceSelections({legacyMonths:15*12,fundMonths:20*12,benefitType:'monthly'});
  assert.deepEqual(choices,[{legacyMonths:15*12,fundMonths:20*12,totalMonths:35*12,droppedLegacyMonths:0,droppedFundMonths:0}]);
});

test('所得替代率依優存、舊制、基金制順序扣減',()=>{
  const result=rules.applyIncomeReplacementCeiling({
    preferentialInterest:10000,legacyMonthly:30000,fundMonthly:50000,finalSalary:50000,totalCreditedMonths:35*12
  });
  closeTo(result.ceiling,69000);
  closeTo(result.before,90000);
  assert.deepEqual(result.deductions,{preferentialInterest:10000,legacyMonthly:11000,fundMonthly:0,total:21000});
  assert.deepEqual(result.after,{preferentialInterest:0,legacyMonthly:19000,fundMonthly:50000,total:69000});
});

test('扣除舊制後仍超限才扣基金制',()=>{
  const result=rules.applyIncomeReplacementCeiling({
    preferentialInterest:5000,legacyMonthly:10000,fundMonthly:60000,finalSalary:40000,totalCreditedMonths:30*12
  });
  closeTo(result.ceiling,49200);
  assert.deepEqual(result.deductions,{preferentialInterest:5000,legacyMonthly:10000,fundMonthly:10800,total:25800});
  closeTo(result.after.total,49200);
});

test('兼領月退的所得替代率上限按二分之一調整',()=>{
  const result=rules.applyIncomeReplacementCeiling({
    legacyMonthly:20000,fundMonthly:20000,finalSalary:50000,totalCreditedMonths:35*12,monthlyShare:.5
  });
  closeTo(result.ceiling,34500);
  closeTo(result.deductions.legacyMonthly,5500);
  closeTo(result.after.total,34500);
});

test('混合制候選結果保留扣減前後及兩制公式',()=>{
  const candidate=rules.calculateMixedPensionCandidate({
    selection:{legacyMonths:15*12,fundMonths:20*12},averageSalary:50000,finalSalary:50000,
    benefitType:'monthly',preferentialInterest:5000
  });
  assert.equal(candidate.eligible,true);
  closeTo(candidate.legacy.fullMonthly,38430);
  closeTo(candidate.fund.fullMonthly,40000);
  closeTo(candidate.grossMonthly,83430);
  closeTo(candidate.ceiling.ceiling,69000);
  closeTo(candidate.netMonthly,69000);
  closeTo(candidate.ceiling.deductions.preferentialInterest,5000);
  closeTo(candidate.ceiling.deductions.legacyMonthly,9430);
});

test('不同取捨可以依一次金或實領月退目標找出較有利方案',()=>{
  const common={legacyMonths:30*12,fundMonths:12*12,averageSalary:50000,finalSalary:50000,benefitType:'monthly'};
  const monthlyBest=rules.findMostFavorableSelection({...common,objective:'monthly'});
  assert.equal(monthlyBest.selection.totalMonths,40*12);
  const all=rules.evaluateServiceSelections(common);
  const max=Math.max(...all.map(x=>x.netMonthly));
  closeTo(monthlyBest.netMonthly,max);
  assert.deepEqual(
    rules.findMostFavorableSelection({...common,objective:'monthly'}).selection,
    monthlyBest.selection,
    '相同輸入應得到固定取捨'
  );
  assert.ok(new Set(all.map(x=>Math.round(x.grossMonthly))).size>1,'不同舊新制取捨應保留可說明的金額差異');
});

test('40 年與 42 年上限多一個月時只捨棄超額月份',()=>{
  const monthly=rules.enumerateServiceSelections({legacyMonths:30*12,fundMonths:10*12+1,benefitType:'monthly'});
  assert.ok(monthly.every(x=>x.droppedLegacyMonths+x.droppedFundMonths===1));
  const lump=rules.enumerateServiceSelections({legacyMonths:30*12,fundMonths:12*12+1,benefitType:'lump'});
  assert.ok(lump.every(x=>x.droppedLegacyMonths+x.droppedFundMonths===1));
});
