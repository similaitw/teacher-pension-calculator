const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../pension-rules.js');

function closeTo(actual,expected,message){
  assert.ok(Math.abs(actual-expected)<1e-10,message||`${actual} should equal ${expected}`);
}

test('混合制的未滿五年舊制年資依括弧標準計算',()=>{
  const cases=[[1,1],[2,3],[3,5],[4,7],[5,9]];
  cases.forEach(([years,bases])=>closeTo(rules.legacyLumpSumBases(years*12),bases));
  closeTo(rules.legacyLumpSumBases(6),.5);
  closeTo(rules.legacyLumpSumBases(18),2);
});

test('舊制一次退休金在 15 年加發兩基數並以 61 為一般上限',()=>{
  const cases=[[5,9],[10,19],[14,27],[15,31],[20,41],[30,61],[31,61]];
  cases.forEach(([years,bases])=>closeTo(rules.legacyLumpSumBases(years*12),bases));
  closeTo(rules.legacyLumpSumBases(14*12+6),28);
  closeTo(rules.legacyLumpSumBases(15*12+6),32);
});

test('舊制月退率前 15 年每年 5%，其後每年 1%，一般上限 90%',()=>{
  const cases=[[1,.05],[5,.25],[15,.75],[20,.80],[30,.90],[35,.90]];
  cases.forEach(([years,rate])=>closeTo(rules.legacyMonthlyPensionRate(years*12),rate));
  closeTo(rules.legacyMonthlyPensionRate(15*12+6),.755);
});

test('符合特殊長期服務條件時使用 81 基數與 95% 上限',()=>{
  closeTo(rules.legacyLumpSumBases(40*12,{specialLongServiceTeacher:true}),81);
  closeTo(rules.legacyMonthlyPensionRate(40*12,{specialLongServiceTeacher:true}),.95);
});

test('舊制一次退分開呈現平均薪額加 930 元與基數',()=>{
  const result=rules.calculateLegacyPension({
    legacyMonths:15*12,totalCreditedMonths:30*12,averageSalary:50000,finalSalary:55000,benefitType:'lump'
  });
  assert.equal(result.eligible,true);
  closeTo(result.lumpBases,31);
  closeTo(result.fullLump,50930*31);
  closeTo(result.lump,50930*31);
  closeTo(result.monthly,0);
});

test('舊制月退分開呈現薪額百分比與十足 930 元',()=>{
  const result=rules.calculateLegacyPension({
    legacyMonths:15*12,totalCreditedMonths:30*12,averageSalary:50000,finalSalary:55000,benefitType:'monthly'
  });
  closeTo(result.monthlyRate,.75);
  closeTo(result.monthlySalaryPortion,37500);
  closeTo(result.monthlyFlatAddition,930);
  closeTo(result.fullMonthly,38430);
  closeTo(result.monthly,38430);
});

test('兼領正確各取二分之一，930 元亦按月退比例計算',()=>{
  const result=rules.calculateLegacyPension({
    legacyMonths:15*12,totalCreditedMonths:30*12,averageSalary:50000,finalSalary:55000,benefitType:'half'
  });
  closeTo(result.lump,(50930*31)/2);
  closeTo(result.monthly,38430/2);
});

test('107 年前已符合月退資格者改用最後在職薪額基準',()=>{
  const result=rules.calculateLegacyPension({
    legacyMonths:15*12,totalCreditedMonths:30*12,averageSalary:50000,finalSalary:55000,
    benefitType:'monthly',qualifiedForMonthlyBefore2018:true
  });
  closeTo(result.monthlySalaryPortion,55000*.75);
  closeTo(result.fullMonthly,55000*.75+930);
});

test('未達一般資格時回傳明確原因而不是零元',()=>{
  const lump=rules.calculateLegacyPension({legacyMonths:48,totalCreditedMonths:48,averageSalary:50000,finalSalary:50000,benefitType:'lump'});
  assert.equal(lump.eligible,false);
  assert.equal(lump.lump,null);
  assert.match(lump.reason,/未滿 5 年/);
  const monthly=rules.calculateLegacyPension({legacyMonths:120,totalCreditedMonths:120,averageSalary:50000,finalSalary:50000,benefitType:'monthly'});
  assert.equal(monthly.eligible,false);
  assert.equal(monthly.monthly,null);
  assert.match(monthly.reason,/未滿 15 年/);
});

test('短舊制加足額基金制年資仍會計算舊制分項',()=>{
  const result=rules.calculateLegacyPension({
    legacyMonths:36,totalCreditedMonths:30*12,averageSalary:50000,finalSalary:55000,benefitType:'monthly'
  });
  assert.equal(result.eligible,true);
  closeTo(result.monthlyRate,.15);
  closeTo(result.monthly,8430);
});

test('總年資不得少於舊制年資',()=>{
  assert.throws(()=>rules.calculateLegacyPension({
    legacyMonths:180,totalCreditedMonths:120,averageSalary:50000,finalSalary:50000,benefitType:'lump'
  }),/不得少於舊制年資/);
});
