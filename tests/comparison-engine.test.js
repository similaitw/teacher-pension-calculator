const test=require('node:test');
const assert=require('node:assert/strict');
const {enumeratePensionScenarios,cumulativeAt,compareAtTargets,findCrossover,monthlyCashAt,sumMonthlyCash}=require('../comparison-engine');

const benefits={lump:{lump:2400000},half:{lump:1200000,monthly:30000},monthly:{monthly:60000}};

test('未滿 58 歲列出一次退、兼領與月退的減額及展期方案',()=>{
  const rows=enumeratePensionScenarios({retirementAge:55,years:30,benefits});
  assert.deepEqual(rows.map(x=>x.id),['lump-full','half-reduced','half-deferred','monthly-reduced','monthly-deferred']);
  assert.equal(rows.find(x=>x.id==='monthly-reduced').monthly,52800);
  assert.equal(rows.find(x=>x.id==='monthly-deferred').startAge,58);
});

test('58 歲與 65 歲以上只列出合法全額或屆齡情境',()=>{
  assert.deepEqual(enumeratePensionScenarios({retirementAge:58,years:30,benefits}).map(x=>x.id),['lump-full','half-full','monthly-full']);
  assert.deepEqual(enumeratePensionScenarios({retirementAge:65,years:30,benefits}).map(x=>x.id),['lump-mandatory','half-mandatory','monthly-mandatory']);
});

test('一次金投資報酬預設為零，開啟後才複利累積',()=>{
  const lump=enumeratePensionScenarios({retirementAge:55,years:30,benefits})[0];
  assert.equal(cumulativeAt(lump,65),2400000);
  assert.equal(Math.round(cumulativeAt(lump,65,.03)),Math.round(2400000*Math.pow(1.03,10)));
});

test('58、65、75、85 歲摘要與同一累積函式一致',()=>{
  const rows=enumeratePensionScenarios({retirementAge:58,years:30,benefits});
  const targets=compareAtTargets(rows,[58,65,75,85]);
  targets.forEach(target=>target.values.forEach(item=>{
    const scenario=rows.find(x=>x.id===item.id);
    assert.equal(item.value,cumulativeAt(scenario,target.age,0));
  }));
});

test('黃金交叉前後一個月差額方向相反',()=>{
  const early={retirementAge:55,startAge:55,lump:0,monthly:48000};
  const late={retirementAge:55,startAge:58,lump:0,monthly:60000};
  const cross=findCrossover(early,late,{endAge:100});
  assert.equal(cross.crossed,true);
  assert.ok(cross.previousDiff<0);
  assert.ok(cross.diff>=0);
  assert.ok(cumulativeAt(late,cross.age-1)-cumulativeAt(early,cross.age-1)<0);
  assert.ok(cumulativeAt(late,cross.age+1)-cumulativeAt(early,cross.age+1)>0);
});

test('沒有交叉時明確回傳 crossed false',()=>{
  const better={retirementAge:58,startAge:58,lump:0,monthly:60000};
  const worse={retirementAge:58,startAge:58,lump:0,monthly:50000};
  assert.equal(findCrossover(better,worse,{startAge:58,endAge:85}).crossed,false);
});

test('退休生效月只計月退休金，不重複計入工作收入',()=>{
  const scenario={retirementMonth:120,monthlyPension:50000,workIncome:80000};
  assert.equal(monthlyCashAt(scenario,119,{includeWorkIncome:true}),80000);
  assert.equal(monthlyCashAt(scenario,120,{includeWorkIncome:true}),50000);
  assert.equal(monthlyCashAt(scenario,119,{includeWorkIncome:false}),0);
});

test('跨退休年度收入等於退休前工作收入加退休後月退',()=>{
  const scenario={retirementMonth:6,monthlyPension:50000,workIncome:80000};
  assert.equal(sumMonthlyCash(scenario,0,12,{includeWorkIncome:true}),80000*6+50000*6);
  assert.equal(sumMonthlyCash(scenario,0,12,{includeWorkIncome:false}),50000*6);
});
