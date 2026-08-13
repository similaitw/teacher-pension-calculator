const reportStoreKey='teacherPensionReport';
const reportSalary={190:25050,200:25820,210:26580,220:27350,230:28120,245:29270,260:30410,275:31560,290:32710,310:33860,330:35010,350:36160,370:37310,390:38460,410:39610,430:40760,450:41900,475:44970,500:46500,525:48030,550:49560,575:51100,600:52630,625:54160,650:55690,680:57220};
const q=id=>document.getElementById(id);
const monthsText=n=>`${Math.floor(n/12)} 年 ${n%12} 月`;
const rocText=d=>`民國 ${d.y} 年 ${d.m} 月`;
const money=n=>Math.round(Number(n)||0).toLocaleString('zh-TW');
const addData=(container,label,value)=>{const d=document.createElement('div'),span=document.createElement('span'),strong=document.createElement('strong');span.textContent=label;strong.textContent=value;d.append(span,strong);container.append(d);};
const addRow=(container,cells,classes='')=>{const d=document.createElement('div');d.className=`sheet-row ${classes}`;cells.forEach(value=>{const s=document.createElement('span');s.textContent=value;d.append(s)});container.append(d);};

function renderReport(data){
  q('emptyReport').hidden=true;q('reportSheet').hidden=false;q('reportTools').hidden=false;
  const generated=new Date(data.generatedAt);q('reportDate').textContent=`產製 ${generated.toLocaleString('zh-TW',{hour12:false})}`;
  q('reportPrimaryLabel').textContent=data.result.primaryLabel;q('reportPrimaryValue').textContent=data.result.primaryValue;q('reportPrimaryUnit').textContent=data.result.primaryUnit;
  q('reportSecondaryLabel').textContent=data.result.secondaryLabel;q('reportSecondaryValue').textContent=data.result.secondaryValue;q('reportSecondaryNote').textContent=data.result.secondaryNote;
  const basic=q('basicData');addData(basic,'適用制度',data.systemLabel);addData(basic,'出生年月',rocText(data.input.birth));addData(basic,'正式到職',rocText(data.input.start));addData(basic,'預計退休',rocText(data.input.retire));addData(basic,'初任學歷',data.input.initialEducation);addData(basic,'目前薪級',`${data.input.currentPoint}（${Number(data.input.currentSalary).toLocaleString('zh-TW')} 元）`);addData(basic,'每月固定薪給',`${money(data.input.workIncome||data.input.currentSalary)} 元`);addData(basic,'年度獎金假設',`年終 ${Number(data.input.yearEndMonths||0)}＋考核 ${Number(data.input.performanceMonths||0)} 個月`);
  addData(basic,'退休金種類',data.input.benefitLabel||'未記錄');if(data.system==='fund'&&data.input.benefitType!=='lump')addData(basic,'月退起領情境',data.input.retirementModeLabel||'未記錄');
  if(data.system==='account'){addData(basic,'自願增加提繳',`${(data.input.voluntaryRate*100).toFixed(2)}%`);addData(basic,'實質報酬假設',`${(data.input.returnRate*100).toFixed(2)}%`);}
  const tenure=q('tenureData');[['曆年任職',data.tenure.rawMonths],['扣除留停',data.tenure.uncreditedLeaveMonths],['另可併計',data.tenure.priorMonths],['可採計年資',data.tenure.creditedMonths]].forEach(([label,value],i)=>{const d=document.createElement('div'),span=document.createElement('span'),strong=document.createElement('strong');if(i===3)d.className='final';span.textContent=label;strong.textContent=monthsText(value);d.append(span,strong);tenure.append(d)});
  const edu=q('educationData');addRow(edu,['時間','學歷／事件','薪級結果'],'header');addRow(edu,[rocText(data.input.start),'初任 '+data.input.initialEducation,'依初任基準']);data.educationEvents.forEach(x=>addRow(edu,[`民國 ${x.y}/${x.m}`,`改敘${x.target}`,x.point?`核定 ${x.point} 薪點`:`提敘 ${x.steps} 級`]));addRow(edu,[rocText(data.input.retire),'退休時預估',`${data.result.retirementPoint}（${Number(data.result.retirementSalary).toLocaleString('zh-TW')} 元）`]);
  const leave=q('leaveData');addRow(leave,['事由','期間','退休年資'],'header');if(!data.leaves.length)addRow(leave,['無','未登錄留職停薪','—']);else data.leaves.forEach(x=>addRow(leave,[x.reason,`民國 ${x.sy}/${x.sm}－${x.ey}/${x.em}`,x.credited?'採計（已繳付）':'不採計（扣除）']));
  const calc=q('calculationData');data.breakdown.forEach(x=>addRow(calc,[x.label,x.value],'single'));
  const scenarios=q('scenarioData');if((data.comparison||[]).length){const header=document.createElement('div');header.className='scenario-report-row header';['方案','一次金','月額','58 歲累積','75 歲累積','85 歲累積'].forEach(v=>{const span=document.createElement('span');span.textContent=v;header.append(span)});scenarios.append(header)}(data.comparison||[]).forEach(x=>{const row=document.createElement('div');row.className='scenario-report-row';const at58=Number(x.at58??(58>=Number(x.startAge)?Number(x.lump)+Number(x.monthly)*(58-Number(x.startAge))*12:0));const values=data.system==='fund'?[x.label,`${money(x.lump)} 元`,`${money(x.monthly)} 元／月`,`${money(at58)} 元`,`${money(x.at75)} 元`,`${money(x.at85)} 元`]:[x.label,`${money(x.lump)} 元`,'依核定月領方案','—','—','—'];values.forEach(v=>{const span=document.createElement('span');span.textContent=v;row.append(span)});scenarios.append(row)});
  if(data.incomeComparison){const x=data.incomeComparison,cross=x.crossoverAge?`${Number(x.crossoverAge).toFixed(1)} 歲`:'無／起點即領先',summary=document.createElement('p');summary.className='income-report-summary';summary.textContent=`年度收入比較｜目前全年工作收入 ${money(x.currentAnnualIncome)} 元｜${x.earlyAge} 歲減額月退 ${money(x.earlyMonthly)} 元／月｜延至 ${x.lateAge} 歲月退 ${money(x.lateMonthly)} 元／月｜延後期間工作收入 ${money(x.salaryUntilLate)} 元｜黃金交叉 ${cross}`;scenarios.append(summary)}
  const salaryTimeline=q('salaryTimelineData');addRow(salaryTimeline,['民國年度','涵蓋月數','薪點／期末薪額'],'header');(data.salaryTimeline||[]).forEach(x=>addRow(salaryTimeline,[`${x.y} 年`,`${x.months} 個月`,`${x.first===x.last?x.first:`${x.first} → ${x.last}`}｜${Number(reportSalary[x.last]).toLocaleString('zh-TW')} 元`]));
  q('eligibilityText').textContent=data.result.eligibility;
}

let data=null;try{data=JSON.parse(localStorage.getItem(reportStoreKey));}catch(error){data=null;}
if(data&&data.version>=2)renderReport(data);else q('emptyReport').hidden=false;
q('printReport').addEventListener('click',()=>window.print());
