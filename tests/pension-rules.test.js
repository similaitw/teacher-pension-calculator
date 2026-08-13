const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../pension-rules.js');

function closeTo(actual,expected,message){
  assert.ok(Math.abs(actual-expected)<1e-10,message||`${actual} should equal ${expected}`);
}

test('平均薪額採計年數符合附表一年度階梯',()=>{
  const cases=[[107,5],[108,5],[109,6],[110,7],[111,8],[112,9],[113,10],[114,11],[115,12],[116,13],[117,14],[118,15],[130,15]];
  cases.forEach(([year,expected])=>assert.equal(rules.averageSalaryYears(year),expected));
});

test('民國 112 年所得替代率凍結值涵蓋 15 至 40 年邊界',()=>{
  const cases=[[15,.39],[20,.465],[25,.54],[30,.615],[35,.69],[40,.715]];
  cases.forEach(([years,expected])=>closeTo(rules.replacementRate(years),expected));
  closeTo(rules.replacementRate(10),.39,'未滿 15 年依附表註記以 15 年計');
  closeTo(rules.replacementRate(45),.715,'替代率最高採計 40 年');
});

test('基金制月退休金給付率符合第 30 條',()=>{
  const cases=[[15,.30],[20,.40],[25,.50],[30,.60],[35,.70],[40,.75]];
  cases.forEach(([years,expected])=>closeTo(rules.fundMonthlyPensionRate(years),expected));
  closeTo(rules.fundMonthlyPensionRate(35.5),.705);
});

test('基金制一次退休金基數符合第 30 條',()=>{
  const cases=[[15,22.5],[20,30],[25,37.5],[30,45],[35,53],[40,58],[42,60]];
  cases.forEach(([years,expected])=>closeTo(rules.fundLumpSumBases(years),expected));
});

test('基數內涵分開處理基金制與舊制 930 元規則',()=>{
  assert.deepEqual(rules.pensionBaseContents({averageSalary:50000,finalSalary:55000}),{
    salaryBasis:50000,legacyLump:50930,legacyMonthly:50000,legacyMonthlyFlatAddition:930,fund:100000
  });
  assert.deepEqual(rules.pensionBaseContents({averageSalary:50000,finalSalary:55000,qualifiedForMonthlyBefore2018:true}),{
    salaryBasis:55000,legacyLump:55930,legacyMonthly:55000,legacyMonthlyFlatAddition:930,fund:110000
  });
});

test('基金制計算回傳可稽核的公式與上限分項',()=>{
  const result=rules.calculateFundPension({years:35,averageSalary:50000,finalSalary:55000});
  closeTo(result.statutoryMonthly,70000);
  closeTo(result.replacementCeiling,75900);
  closeTo(result.monthly,70000);
  closeTo(result.lumpBases,53);
  closeTo(result.lump,5300000);

  const capped=rules.calculateFundPension({years:35,averageSalary:60000,finalSalary:40000});
  closeTo(capped.statutoryMonthly,84000);
  closeTo(capped.replacementCeiling,55200);
  closeTo(capped.monthly,55200);
});

test('法規版本與來源可追溯',()=>{
  assert.equal(rules.RULES_VERSION,'MOE-114.12.26');
  assert.equal(rules.LEGAL_RULES.amendedDate,'2025-12-26');
  assert.match(rules.LEGAL_RULES.source,/edu\.law\.moe\.gov\.tw/);
});
