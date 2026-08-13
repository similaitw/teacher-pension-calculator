const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../service-tenure.js');

const m=model.monthIndex;

test('教師年資在 85/2/1 正確切分舊制與基金制',()=>{
  const result=model.calculateServiceTenure({segments:[{id:'teacher',serviceType:'teacher',start:m(85,1),end:m(85,3)}]});
  assert.deepEqual(result.counted,{legacy:1,fund:1,account:0});
  assert.deepEqual(result.splitSegments.map(x=>[x.scheme,x.months]),[['legacy',1],['fund',1]]);
});

test('轉任公務、政務與軍職使用各自法定分界',()=>{
  const cases=[
    ['civil',84,7],
    ['political',85,5],
    ['military',86,1]
  ];
  cases.forEach(([serviceType,year,month])=>{
    const cutoff=m(year,month);
    assert.equal(model.classifyServiceMonth(cutoff-1,serviceType),'legacy');
    assert.equal(model.classifyServiceMonth(cutoff,serviceType),'fund');
  });
});

test('基金制軌道人員在 112/7 後仍維持基金制',()=>{
  const result=model.calculateServiceTenure({retirementTrack:'fund',segments:[{start:m(112,6),end:m(112,9),serviceType:'teacher'}]});
  assert.deepEqual(result.counted,{legacy:0,fund:3,account:0});
});

test('112/7 後初任個人專戶軌道歸入 account',()=>{
  const result=model.calculateServiceTenure({retirementTrack:'account',segments:[{start:m(112,7),end:m(112,10),serviceType:'teacher'}]});
  assert.deepEqual(result.counted,{legacy:0,fund:0,account:3});
  assert.throws(()=>model.calculateServiceTenure({retirementTrack:'account',segments:[{start:m(112,6),end:m(112,8),serviceType:'teacher'}]}),/112 年 7 月以前/);
});

test('留停或未繳費按制度排除，舊制不以基金繳費判斷',()=>{
  const result=model.calculateServiceTenure({segments:[
    {id:'old',scheme:'legacy',serviceType:'teacher',start:m(84,1),end:m(84,3),contributionPaid:false},
    {id:'leave',scheme:'fund',serviceType:'teacher',start:m(90,1),end:m(90,3),credited:false},
    {id:'unpaid',scheme:'fund',serviceType:'teacher',start:m(90,3),end:m(90,5),contributionPaid:false}
  ]});
  assert.deepEqual(result.counted,{legacy:2,fund:0,account:0});
  assert.deepEqual(result.excluded,{legacy:0,fund:4,account:0});
  assert.equal(result.excludedByReason['not-credited'],2);
  assert.equal(result.excludedByReason['contribution-not-paid'],2);
});

test('已領退休、資遣、離職退費的月份不得重複採計',()=>{
  const result=model.calculateServiceTenure({segments:[
    {id:'paid-out',serviceType:'teacher',start:m(90,1),end:m(90,7),benefitPreviouslyReceived:true}
  ]});
  assert.equal(result.creditedMonths,0);
  assert.equal(result.excludedByReason['benefit-previously-received'],6);
});

test('重疊月份只計一次並留下稽核紀錄',()=>{
  const result=model.calculateServiceTenure({segments:[
    {id:'a',serviceType:'teacher',start:m(90,1),end:m(90,4)},
    {id:'b',serviceType:'teacher',start:m(90,3),end:m(90,6)}
  ]});
  assert.equal(result.creditedMonths,5);
  assert.equal(result.calendarMonths,5);
  assert.equal(result.overlaps.length,1);
  assert.equal(result.hasBlockingConflict,false);
});

test('不同制度區段重疊時標示為阻擋衝突',()=>{
  const result=model.calculateServiceTenure({segments:[
    {id:'legacy',scheme:'legacy',serviceType:'other',start:m(84,1),end:m(84,3)},
    {id:'fund',scheme:'fund',serviceType:'other',start:m(84,2),end:m(84,4)}
  ]});
  assert.equal(result.conflicts.length,1);
  assert.equal(result.hasBlockingConflict,true);
});

test('核定舊制月數覆寫逐段舊制小計但不重複加入',()=>{
  const result=model.calculateServiceTenure({
    legacyInput:{mode:'certifiedMonths',certifiedMonths:24},
    segments:[
      {serviceType:'teacher',start:m(84,1),end:m(85,2)},
      {serviceType:'teacher',start:m(85,2),end:m(86,2)}
    ]
  });
  assert.deepEqual(result.counted,{legacy:24,fund:12,account:0});
  assert.equal(result.creditedMonths,36);
  assert.equal(result.legacyMode,'certifiedMonths');
});

test('其他服務類型必須明確指定制度',()=>{
  assert.throws(()=>model.calculateServiceTenure({segments:[{serviceType:'other',start:m(90,1),end:m(90,2)}]}),/明確指定/);
});

test('空白年資資料安全回傳零值',()=>{
  const result=model.calculateServiceTenure();
  assert.deepEqual(result.counted,{legacy:0,fund:0,account:0});
  assert.equal(result.creditedMonths,0);
  assert.equal(result.splitSegments.length,0);
});

test('排除區段保留原因與證據供後續報表使用',()=>{
  const result=model.calculateServiceTenure({segments:[{
    id:'refunded',serviceType:'civil',start:m(90,1),end:m(90,3),benefitPreviouslyReceived:true,evidence:'離職退費核定函'
  }]});
  assert.equal(result.splitSegments[0].exclusionReason,'benefit-previously-received');
  assert.equal(result.splitSegments[0].evidence,'離職退費核定函');
  assert.equal(result.months[0].selectedSegmentId,'refunded');
});
