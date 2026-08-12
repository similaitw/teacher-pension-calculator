const reportStoreKey='teacherPensionReport';
const q=id=>document.getElementById(id);
const monthsText=n=>`${Math.floor(n/12)} 年 ${n%12} 月`;
const rocText=d=>`民國 ${d.y} 年 ${d.m} 月`;
const addData=(container,label,value)=>{const d=document.createElement('div'),span=document.createElement('span'),strong=document.createElement('strong');span.textContent=label;strong.textContent=value;d.append(span,strong);container.append(d);};
const addRow=(container,cells,classes='')=>{const d=document.createElement('div');d.className=`sheet-row ${classes}`;cells.forEach(value=>{const s=document.createElement('span');s.textContent=value;d.append(s)});container.append(d);};

function renderReport(data){
  q('emptyReport').hidden=true;q('reportSheet').hidden=false;q('reportTools').hidden=false;
  const generated=new Date(data.generatedAt);q('reportDate').textContent=`產製 ${generated.toLocaleString('zh-TW',{hour12:false})}`;
  q('reportPrimaryLabel').textContent=data.result.primaryLabel;q('reportPrimaryValue').textContent=data.result.primaryValue;q('reportPrimaryUnit').textContent=data.result.primaryUnit;
  q('reportSecondaryLabel').textContent=data.result.secondaryLabel;q('reportSecondaryValue').textContent=data.result.secondaryValue;q('reportSecondaryNote').textContent=data.result.secondaryNote;
  const basic=q('basicData');addData(basic,'適用制度',data.systemLabel);addData(basic,'出生年月',rocText(data.input.birth));addData(basic,'正式到職',rocText(data.input.start));addData(basic,'預計退休',rocText(data.input.retire));addData(basic,'初任學歷',data.input.initialEducation);addData(basic,'目前薪級',`${data.input.currentPoint}（${Number(data.input.currentSalary).toLocaleString('zh-TW')} 元）`);
  if(data.system==='account'){addData(basic,'自願增加提繳',`${(data.input.voluntaryRate*100).toFixed(2)}%`);addData(basic,'實質報酬假設',`${(data.input.returnRate*100).toFixed(2)}%`);}
  const tenure=q('tenureData');[['曆年任職',data.tenure.rawMonths],['扣除留停',data.tenure.uncreditedLeaveMonths],['另可併計',data.tenure.priorMonths],['可採計年資',data.tenure.creditedMonths]].forEach(([label,value],i)=>{const d=document.createElement('div'),span=document.createElement('span'),strong=document.createElement('strong');if(i===3)d.className='final';span.textContent=label;strong.textContent=monthsText(value);d.append(span,strong);tenure.append(d)});
  const edu=q('educationData');addRow(edu,['時間','學歷／事件','薪級結果'],'header');addRow(edu,[rocText(data.input.start),'初任 '+data.input.initialEducation,'依初任基準']);data.educationEvents.forEach(x=>addRow(edu,[`民國 ${x.y}/${x.m}`,`改敘${x.target}`,x.point?`核定 ${x.point} 薪點`:`提敘 ${x.steps} 級`]));addRow(edu,[rocText(data.input.retire),'退休時預估',`${data.result.retirementPoint}（${Number(data.result.retirementSalary).toLocaleString('zh-TW')} 元）`]);
  const leave=q('leaveData');addRow(leave,['事由','期間','退休年資'],'header');if(!data.leaves.length)addRow(leave,['無','未登錄留職停薪','—']);else data.leaves.forEach(x=>addRow(leave,[x.reason,`民國 ${x.sy}/${x.sm}－${x.ey}/${x.em}`,x.credited?'採計（已繳付）':'不採計（扣除）']));
  const calc=q('calculationData');data.breakdown.forEach(x=>addRow(calc,[x.label,x.value],'single'));
  q('eligibilityText').textContent=data.result.eligibility;
}

let data=null;try{data=JSON.parse(localStorage.getItem(reportStoreKey));}catch(error){data=null;}
if(data&&data.version>=2)renderReport(data);else q('emptyReport').hidden=false;
q('printReport').addEventListener('click',()=>window.print());
