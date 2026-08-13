const test=require('node:test');
const assert=require('node:assert/strict');
const validator=require('../scripts/validate-official-cases.js');

function completeExpected(testCase){
  return {...testCase,expected:{...validator.calculateCase(testCase)}};
}

function baseCase(id,category,input){
  return {id,category,source:{document:`${id}-正式資料代稱`,anonymized:true},input,tolerance:{money:1,months:0}};
}

test('純基金制正式案例可逐欄比對',()=>{
  const item=completeExpected(baseCase('PF-001','pure-fund',{
    legacyMonths:0,fundMonths:35*12,averageSalary:55690,finalSalary:55690
  }));
  const result=validator.compareCase(item);
  assert.equal(result.passed,true);
  assert.equal(result.comparisons.length,validator.REQUIRED_EXPECTED_FIELDS.length);
});

test('舊新混合案例同時比對最有利一次退、月退與扣減',()=>{
  const item=completeExpected(baseCase('MX-001','mixed',{
    legacyMonths:15*12,fundMonths:20*12,averageSalary:50000,finalSalary:50000,preferentialInterest:5000
  }));
  const result=validator.compareCase(item);
  assert.equal(result.passed,true);
  assert.ok(result.actual.lump>0);
  assert.ok(result.actual.monthly>0);
  assert.ok(result.actual.totalDeduction>0);
});

test('含留停案例由逐段資料排除未採計月份',()=>{
  const item=completeExpected(baseCase('LV-001','leave-or-combined',{
    retirementTrack:'fund',
    segments:[
      {id:'service-a',serviceType:'other',scheme:'fund',start:1000,end:1180},
      {id:'leave',serviceType:'other',scheme:'fund',start:1180,end:1192,credited:false,contributionPaid:false},
      {id:'service-b',serviceType:'other',scheme:'fund',start:1192,end:1372}
    ],
    averageSalary:52000,finalSalary:52000
  }));
  const result=validator.compareCase(item);
  assert.equal(result.passed,true);
  assert.equal(result.actual.creditedMonths,360);
  assert.equal(result.actual.fundMonths,360);
});

test('三種類別未齊時正式發布閘門必須失敗',()=>{
  const pure=completeExpected(baseCase('PF-ONLY','pure-fund',{
    legacyMonths:0,fundMonths:30*12,averageSalary:50000,finalSalary:50000
  }));
  const report=validator.validateCaseCollection([pure]);
  assert.equal(report.passed,false);
  assert.ok(report.errors.some(message=>message.includes('mixed')));
  assert.ok(report.errors.some(message=>message.includes('leave-or-combined')));
});

test('超出容許誤差時回報欄位差額',()=>{
  const item=completeExpected(baseCase('PF-DIFF','pure-fund',{
    legacyMonths:0,fundMonths:35*12,averageSalary:55690,finalSalary:55690
  }));
  item.expected.monthly+=10;
  const result=validator.compareCase(item);
  const monthly=result.comparisons.find(entry=>entry.field==='monthly');
  assert.equal(result.passed,false);
  assert.equal(monthly.difference,-10);
  assert.equal(monthly.tolerance,1);
});

test('未確認去識別化的案例不得進入比對',()=>{
  const item=baseCase('PF-PRIVATE','pure-fund',{
    legacyMonths:0,fundMonths:30*12,averageSalary:50000,finalSalary:50000
  });
  item.source.anonymized=false;
  assert.throws(()=>validator.calculateCase(item),/anonymized/);
});
