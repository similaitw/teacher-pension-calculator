const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../pension-rules');

test('每月核定優存利息直接採用正式輸入值',()=>{
  const result=rules.resolvePreferentialDepositInput({mode:'monthlyInterest',monthlyInterest:3500});
  assert.equal(result.monthlyInterest,3500);
  assert.equal(result.derived,false);
});

test('核定本金模式只依使用者輸入的核定利率換算月息',()=>{
  const result=rules.resolvePreferentialDepositInput({mode:'principal',principal:1200000,annualRate:.03});
  assert.equal(result.monthlyInterest,3000);
  assert.equal(result.principal,1200000);
  assert.equal(result.annualRate,.03);
  assert.equal(result.derived,true);
});

test('本金與月息不得為負數，利率不得超過百分之百',()=>{
  assert.throws(()=>rules.resolvePreferentialDepositInput({mode:'monthlyInterest',monthlyInterest:-1}),/不能是負數/);
  assert.throws(()=>rules.resolvePreferentialDepositInput({mode:'principal',principal:-1,annualRate:.03}),/不能是負數/);
  assert.throws(()=>rules.resolvePreferentialDepositInput({mode:'principal',principal:1000,annualRate:1.01}),/不得超過/);
});

test('優惠存款只參與月退所得扣減，不增加一次退休金',()=>{
  const common={selection:{legacyMonths:10*12,fundMonths:25*12},averageSalary:50000,finalSalary:50000,benefitType:'half'};
  const without=rules.calculateMixedPensionCandidate({...common,preferentialInterest:0});
  const withInterest=rules.calculateMixedPensionCandidate({...common,preferentialInterest:3000});
  assert.equal(withInterest.grossLump,without.grossLump);
  assert.equal(withInterest.legacy.lump,without.legacy.lump);
  assert.equal(withInterest.fund.lump,without.fund.lump);
  assert.equal(withInterest.grossMonthly-without.grossMonthly,3000);
});
