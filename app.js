const SALARY={190:25050,200:25820,210:26580,220:27350,230:28120,245:29270,260:30410,275:31560,290:32710,310:33860,330:35010,350:36160,370:37310,390:38460,410:39610,430:40760,450:41900,475:44970,500:46500,525:48030,550:49560,575:51100,600:52630,625:54160,650:55690,680:57220};
const LADDER=Object.keys(SALARY).map(Number);
const EDU={
  bachelor:{label:'大學',start:190,baseMax:450,ceiling:625,rank:1},
  credit40:{label:'40 學分班',start:245,baseMax:500,ceiling:625,rank:1},
  master:{label:'碩士',start:245,baseMax:525,ceiling:650,rank:2},
  phd:{label:'博士',start:330,baseMax:550,ceiling:680,rank:3}
};
const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n).toLocaleString('zh-TW');
const monthIndex=(y,m)=>Number(y)*12+Number(m)-1;
const duration=(a,b)=>Math.max(0,b-a);
const ymText=months=>`${Math.floor(months/12)} 年 ${months%12} 月`;
let leaveSeq=0,educationSeq=0;

function fillSalaryPoints(){
  const previous=Number($('salaryPoint').value)||450;
  $('salaryPoint').innerHTML='';
  LADDER.slice().reverse().forEach(p=>{
    const o=document.createElement('option');o.value=p;o.textContent=`${p}（${fmt(SALARY[p])} 元）`;$('salaryPoint').append(o);
  });
  $('salaryPoint').value=LADDER.includes(previous)?previous:450;updateSalary();
}
function updateSalary(){$('salaryAmount').textContent=`${fmt(SALARY[$('salaryPoint').value])} 元`;}
function pointOptions(select,target,selected=''){
  const current=selected||select.value;select.innerHTML='<option value="">不清楚，由系統依法推算</option>';
  const ceiling=EDU[target].ceiling;LADDER.filter(p=>p<=ceiling).reverse().forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=`${p}（${fmt(SALARY[p])} 元）`;select.append(o);});
  if(current&&LADDER.includes(Number(current))&&Number(current)<=ceiling)select.value=current;
}

function renumberEducation(){document.querySelectorAll('.education-item').forEach((el,i)=>el.querySelector('.education-number span').textContent=String(i+1).padStart(2,'0'));}
function addEducation(values={}){
  const node=$('educationTemplate').content.firstElementChild.cloneNode(true);node.dataset.id=++educationSeq;
  const target=node.querySelector('.education-target'),point=node.querySelector('.education-point');target.value=values.target||'master';
  node.querySelector('.education-y').value=values.y||'';node.querySelector('.education-m').value=values.m||'';pointOptions(point,target.value,values.point||'');
  target.addEventListener('change',()=>pointOptions(point,target.value));node.querySelector('.remove-education').addEventListener('click',()=>{node.remove();renumberEducation();});
  $('educationList').append(node);renumberEducation();
}
function renumberLeaves(){document.querySelectorAll('.leave-item').forEach((el,i)=>el.querySelector('.leave-number span').textContent=String(i+1).padStart(2,'0'));}
function addLeave(values={}){
  const node=$('leaveTemplate').content.firstElementChild.cloneNode(true);node.dataset.id=++leaveSeq;
  node.querySelector('.leave-reason').value=values.reason||'育嬰';node.querySelector('.leave-start-y').value=values.sy||'';node.querySelector('.leave-start-m').value=values.sm||'';
  node.querySelector('.leave-end-y').value=values.ey||'';node.querySelector('.leave-end-m').value=values.em||'';node.querySelector('.leave-credited').checked=Boolean(values.credited);
  node.querySelector('.remove-leave').addEventListener('click',()=>{node.remove();renumberLeaves();});$('leaveList').append(node);renumberLeaves();
}
function readRoc(prefix){return{y:Number($(prefix+'Y').value),m:Number($(prefix+'M').value)};}
function validDate(d){return Number.isInteger(d.y)&&d.y>=1&&d.y<=200&&Number.isInteger(d.m)&&d.m>=1&&d.m<=12;}
function mergeIntervals(intervals){
  const sorted=intervals.filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0]),out=[];
  sorted.forEach(x=>{const last=out[out.length-1];if(!last||x[0]>last[1])out.push([...x]);else last[1]=Math.max(last[1],x[1]);});return out;
}
function overlapMonths(intervals,start,end){return mergeIntervals(intervals.map(([a,b])=>[Math.max(a,start),Math.min(b,end)])).reduce((s,[a,b])=>s+duration(a,b),0);}
function readLeaves(workStart,workEnd){
  const rows=[];document.querySelectorAll('.leave-item').forEach((el,i)=>{
    const sy=Number(el.querySelector('.leave-start-y').value),sm=Number(el.querySelector('.leave-start-m').value),ey=Number(el.querySelector('.leave-end-y').value),em=Number(el.querySelector('.leave-end-m').value);
    if(!sy&&!sm&&!ey&&!em)return;const sd={y:sy,m:sm},ed={y:ey,m:em};if(!validDate(sd)||!validDate(ed))throw new Error(`第 ${i+1} 段留停的年月不完整。`);
    const start=monthIndex(sy,sm),end=monthIndex(ey,em)+1;if(end<=start)throw new Error(`第 ${i+1} 段留停的結束年月必須晚於起始年月。`);if(end<=workStart||start>=workEnd)throw new Error(`第 ${i+1} 段留停不在到職至退休期間內。`);
    rows.push({reason:el.querySelector('.leave-reason').value,credited:el.querySelector('.leave-credited').checked,start,end,sy,sm,ey,em});
  });return rows;
}
function readEducationEvents(initial,workStart,workEnd){
  const rows=[];document.querySelectorAll('.education-item').forEach((el,i)=>{
    const y=Number(el.querySelector('.education-y').value),m=Number(el.querySelector('.education-m').value);if(!y&&!m)return;if(!validDate({y,m}))throw new Error(`第 ${i+1} 筆學歷改敘的生效年月不完整。`);
    const at=monthIndex(y,m),target=el.querySelector('.education-target').value,point=Number(el.querySelector('.education-point').value)||null;
    if(at<workStart||at>=workEnd)throw new Error(`第 ${i+1} 筆學歷改敘必須在到職至退休期間內。`);if(point&&point>EDU[target].ceiling)throw new Error(`第 ${i+1} 筆核定薪點超過${EDU[target].label}年功薪上限。`);
    rows.push({at,y,m,target,point,order:i+1});
  });
  rows.sort((a,b)=>a.at-b.at);let degree=initial,lastAt=-1;
  rows.forEach((row,i)=>{if(row.at===lastAt)throw new Error('同一個月只能有一筆學歷改敘。');if(EDU[row.target].rank<=EDU[degree].rank)throw new Error(`第 ${row.order} 筆改敘不是比當時更高的學歷。`);row.fromDegree=degree;row.steps=raiseSteps(degree,row.target);degree=row.target;lastAt=row.at;row.sequence=i+1;});return rows;
}
function raiseSteps(from,to){if(to==='master')return 3;if(to==='phd')return from==='master'?2:5;return 0;}
function runSalaryTimeline(initial,events,start,end,initialIdx){
  let degree=initial,idx=initialIdx;const points=[],eventMap=new Map(events.map(e=>[e.at,e]));
  for(let at=start;at<end;at++){
    const event=eventMap.get(at);
    if(event){
      if(event.point)idx=Math.max(idx,LADDER.indexOf(event.point));
      else{const cfg=EDU[event.target],proposed=Math.max(LADDER.indexOf(cfg.start),idx+raiseSteps(degree,event.target));idx=Math.max(idx,Math.min(LADDER.indexOf(cfg.baseMax),proposed));}
      degree=event.target;
    }
    if(at>start&&(at-start)%12===0)idx=Math.min(idx+1,LADDER.indexOf(EDU[degree].ceiling));
    points.push(LADDER[idx]);
  }
  return points;
}
function buildSalaryTimeline(initial,events,start,end,currentPoint){
  const now=new Date(),today=monthIndex(now.getFullYear()-1911,now.getMonth()+1),anchor=today>=start&&today<end?today-start:end-start-1;
  const min=LADDER.indexOf(EDU[initial].start),max=LADDER.indexOf(EDU[initial].ceiling),targetIdx=LADDER.indexOf(currentPoint);let best=null,bestGap=Infinity;
  for(let seed=min;seed<=max;seed++){const points=runSalaryTimeline(initial,events,start,end,seed),gap=Math.abs(LADDER.indexOf(points[anchor])-targetIdx);if(gap<bestGap){best={points,seed,gap};bestGap=gap;}}
  return{points:best.points,salaries:best.points.map(p=>SALARY[p]),anchorGap:best.gap};
}
function isInIntervals(at,intervals){return intervals.some(([a,b])=>at>=a&&at<b);}
function salaryAverageWindow(salaries,start,excluded,targetMonths){
  const merged=mergeIntervals(excluded),selected=[];
  for(let i=salaries.length-1;i>=0&&selected.length<targetMonths;i--){if(!isInIntervals(start+i,merged))selected.push({at:start+i,salary:salaries[i]});}
  const avg=selected.reduce((sum,x)=>sum+x.salary,0)/Math.max(1,selected.length);
  return{avg,months:selected.length,from:selected.length?selected[selected.length-1].at:start,to:selected.length?selected[0].at:start};
}
function monthLabel(at){return`民國 ${Math.floor(at/12)} 年 ${at%12+1} 月`;}
function annualSalarySummary(points,start){
  const map=new Map();points.forEach((point,i)=>{const at=start+i,y=Math.floor(at/12);if(!map.has(y))map.set(y,{y,first:point,last:point,months:0});const row=map.get(y);row.last=point;row.months++;});return Array.from(map.values());
}
function renderSalaryTimeline(summary){
  $('salaryTimelineList').innerHTML='';summary.forEach(row=>{const d=document.createElement('div');d.className='timeline-row';const range=row.first===row.last?String(row.first):`${row.first} → ${row.last}`;[`${row.y} 年`,`${row.months} 個月`,`${range} 薪點｜${fmt(SALARY[row.last])} 元`].forEach(v=>{const s=document.createElement('span');s.textContent=v;d.append(s)});$('salaryTimelineList').append(d);});
}
function replacementRate(years){if(years<=15)return .39;if(years<=35)return .39+(years-15)*.015;return Math.min(.715,.69+(years-35)*.005);}
function pensionRate(years){const full=Math.floor(Math.min(years,40)),frac=Math.min(years,40)-full;let rate=full<=35?full*.02:35*.02+(full-35)*.01;return rate+frac*(full<35?.02:.01);}
function lumpSumBases(years){const capped=Math.min(years,42);if(capped<35)return capped*1.5;if(capped===35)return 53;return Math.min(60,53+(capped-35));}
function contributionBalance(salaries,start,excluded,voluntaryRate,annualReturn){
  let bal=0,baseTotal=0,paidMonths=0;const monthlyReturn=Math.pow(1+annualReturn,1/12)-1,merged=mergeIntervals(excluded),totalRate=.15+voluntaryRate;
  salaries.forEach((salary,i)=>{const at=start+i;if(!isInIntervals(at,merged)){const base=salary*2,c=base*totalRate;bal=(bal+c)*(1+monthlyReturn);baseTotal+=base;paidMonths++;}else bal*=1+monthlyReturn;});
  const govPrincipal=baseTotal*.0975,selfPrincipal=baseTotal*.0525,voluntaryPrincipal=baseTotal*voluntaryRate,principal=govPrincipal+selfPrincipal+voluntaryPrincipal;
  return{bal,principal,paidMonths,baseTotal,govPrincipal,selfPrincipal,voluntaryPrincipal,monthlyReturn};
}
function addLine(label,value){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);$('breakdownList').append(row);}
function renderAudit(rows){
  $('leaveAuditList').innerHTML='';if(!rows.length){$('leaveAuditList').innerHTML='<p class="empty-audit">沒有登錄留職停薪期間。</p>';return;}
  rows.forEach(r=>{const d=document.createElement('div');d.className='audit-row';d.innerHTML=`<span>${r.reason}</span><span>民國 ${r.sy}/${r.sm} — ${r.ey}/${r.em}</span><span class="${r.credited?'yes':'no'}">${r.credited?'採計（已繳付）':'不採計（扣除）'}</span>`;$('leaveAuditList').append(d);});
}
function cumulativeAt(scenario,targetAge){return scenario.lump+scenario.monthly*Math.max(0,targetAge-scenario.startAge)*12;}
function renderFundComparison({age,years,fullLump,baseMonthly,benefitType,retirementMode}){
  const scenarios=[],add=(type,mode,label,startAge,deduction=0)=>{const share=type==='half'?.5:1;scenarios.push({type,mode,label,startAge,lump:type==='lump'?fullLump:type==='half'?fullLump*.5:0,monthly:type==='lump'?0:baseMonthly*share*(1-deduction),deduction});};
  add('lump',age>=65?'mandatory':'full',age>=65?'一次退｜屆齡':'一次退｜一般',age);
  if(years>=15){
    ['half','monthly'].forEach(type=>{
      const name=type==='half'?'半月退':'月退';
      if(age>=65)add(type,'mandatory',`${name}｜屆齡`,age);
      else if(age>=58)add(type,'full',`${name}｜全額`,age);
      else{
        if(age>=53)add(type,'reduced',`${name}｜減額`,age,Math.min(.2,(58-age)*.04));
        add(type,'deferred',`${name}｜展期`,58);
      }
    });
  }
  const targets=[65,75,85],maxima=Object.fromEntries(targets.map(t=>[t,Math.max(...scenarios.map(s=>cumulativeAt(s,t)))]));
  $('comparisonRows').innerHTML='';scenarios.forEach(s=>{
    const selected=s.type===benefitType&&(benefitType==='lump'||s.mode===retirementMode),tr=document.createElement('tr');if(selected)tr.className='is-selected';
    const cells=[`<span class="scenario-name">${s.label}</span>${selected?'<span class="scenario-tag selected">目前選擇</span>':s.deduction?`<span class="scenario-tag">減 ${(s.deduction*100).toFixed(2)}%</span>`:''}`,s.monthly?`${s.startAge.toFixed(2)} 歲`:'退休時',`${fmt(s.lump)} 元`,s.monthly?`${fmt(s.monthly)} 元`:'—',...targets.map(t=>{const value=cumulativeAt(s,t),best=Math.abs(value-maxima[t])<1;return `<span class="${best?'best':''}">${fmt(value)}${best?' ★':''}</span>`;})];
    cells.forEach((html,i)=>{const td=document.createElement('td');td.innerHTML=html;tr.append(td)});$('comparisonRows').append(tr);
  });
  const reduced=scenarios.find(s=>s.type==='monthly'&&s.mode==='reduced'),deferred=scenarios.find(s=>s.type==='monthly'&&s.mode==='deferred');let insight='';
  if(reduced&&deferred){const lead=reduced.monthly*(58-age)*12,diff=deferred.monthly-reduced.monthly,cross=58+lead/diff/12;insight=`減額月退從退休起先領，至 58 歲約累積 <strong>${fmt(lead)} 元</strong>領先；全額展期月退約在 <strong>${cross.toFixed(1)} 歲</strong>追平，之後展期方案累積較高。`;}
  else if(baseMonthly>0){const cross=age+fullLump/baseMonthly/12;insight=`以一次退休金與全額月退休金直接比較，不計利息時，月退休金累積約在 <strong>${cross.toFixed(1)} 歲</strong>超過一次退休金。`;}
  $('breakEvenInsight').innerHTML=insight;$('comparisonNote').textContent='★ 表示該年齡節點累積金額最高。半月退同時保留一半一次金與一半月退；實際較有利方案仍取決於壽命、資金需求、投資報酬與遺族保障。';
  return scenarios.map(s=>({label:s.label,startAge:s.startAge,lump:s.lump,monthly:s.monthly,deduction:s.deduction,at65:cumulativeAt(s,65),at75:cumulativeAt(s,75),at85:cumulativeAt(s,85)}));
}
function renderAccountComparison(balance,benefitType){
  const rows=[{type:'lump',label:'一次退',lump:balance,monthly:0},{type:'half',label:'半月退',lump:balance*.5,monthly:null},{type:'monthly',label:'月退',lump:0,monthly:null}];$('comparisonRows').innerHTML='';
  rows.forEach(s=>{const tr=document.createElement('tr');if(s.type===benefitType)tr.className='is-selected';[`${s.label}${s.type===benefitType?'｜目前選擇':''}`,'依核定方案',`${fmt(s.lump)} 元`,s.monthly===0?'—':'依攤提／年金方案','—','—','—'].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td)});$('comparisonRows').append(tr)});
  $('breakEvenInsight').innerHTML='個人專戶制的月領金額取決於退休時選定的定額、定率攤提或年金保險方案；目前只能完整比較<strong>一次領取比例</strong>，不能用單一月額做可靠的損益交叉推算。';$('comparisonNote').textContent='專戶制應在取得實際專戶餘額及各月領方案報價後，再比較累積給付與遺族保障。';return rows;
}
function syncLiveBar(){
  $('liveBar').classList.remove('has-error','is-updating');$('liveChoice').textContent=`${document.querySelector('[name=benefitType]:checked').closest('label').querySelector('strong').textContent}｜${document.querySelector('[name=retirementMode]:checked').closest('label').querySelector('strong').textContent}`;$('liveLabel').textContent=$('primaryLabel').textContent;$('liveValue').textContent=$('primaryValue').textContent;$('liveUnit').textContent=$('primaryUnit').textContent;$('liveTenure').textContent=$('creditedTenure').textContent;$('liveEligibility').textContent=$('eligibility').textContent;
}
function calculate(e,options={}){
  if(e)e.preventDefault();$('formError').textContent='';
  try{
    const birth=readRoc('birth'),start=readRoc('start'),retire=readRoc('retire');if(!validDate(birth)||!validDate(start)||!validDate(retire))throw new Error('請確認出生、到職與退休年月。');
    const b=monthIndex(birth.y,birth.m),s=monthIndex(start.y,start.m),r=monthIndex(retire.y,retire.m);if(s<=b||r<=s)throw new Error('退休年月必須晚於到職年月，到職年月也必須晚於出生年月。');
    const initial=$('education').value,events=readEducationEvents(initial,s,r),leaves=readLeaves(s,r),raw=duration(s,r),allLeave=overlapMonths(leaves.map(x=>[x.start,x.end]),s,r),excluded=leaves.filter(x=>!x.credited).map(x=>[x.start,x.end]),uncredited=overlapMonths(excluded,s,r);
    const prior=Number($('priorYears').value||0)*12+Number($('priorMonths').value||0);if(prior<0)throw new Error('可併計年資不能是負數。');
    const credited=Math.max(0,raw-uncredited+prior),years=credited/12,age=(r-b)/12,currentPoint=Number($('salaryPoint').value),timeline=buildSalaryTimeline(initial,events,s,r,currentPoint),last=timeline.salaries[timeline.salaries.length-1],system=document.querySelector('[name=system]:checked').value,benefitType=document.querySelector('[name=benefitType]:checked').value,retirementMode=document.querySelector('[name=retirementMode]:checked').value;
    if(years<15&&benefitType!=='lump')throw new Error('可採計年資未滿 15 年，依法原則上只能選擇一次退休金。');
    const annualSummary=annualSalarySummary(timeline.points,s);$('rawTenure').textContent=ymText(raw);$('leaveDeduct').textContent=ymText(uncredited);$('priorTenure').textContent=ymText(prior);$('creditedTenure').textContent=ymText(credited);$('retireAge').textContent=ymText(r-b);$('leaveTotal').textContent=ymText(allLeave);$('leaveSummary').textContent=allLeave?`其中 ${ymText(uncredited)} 不採計`:'未登錄留停';$('breakdownList').innerHTML='';renderAudit(leaves);renderSalaryTimeline(annualSummary);
    let comparison=[];if(system==='fund'){
      const avgYears=Math.min(15,retire.y>=118?15:Math.max(5,retire.y-103)),avgWindow=salaryAverageWindow(timeline.salaries,s,excluded,avgYears*12),avg=avgWindow.avg,pRate=pensionRate(years),rRate=replacementRate(years),formula=avg*2*pRate,ceiling=last*2*rRate,baseMonthly=Math.min(formula,ceiling),bases=lumpSumBases(years),fullLump=avg*2*bases,gpiMonths=Math.min(42,years*1.2),gpi=last*gpiMonths;
      let earlyYears=0,deduct=0,startNote='退休生效日起';
      if(retirementMode==='mandatory'&&age<65)throw new Error('屆齡退休情境須於退休時年滿 65 歲。');
      if(benefitType!=='lump'){
        if(retirementMode==='full'&&age<58)throw new Error('尚未滿 58 歲；月退休金請改選「減額月退」或「展期月退」。');
        if(retirementMode==='reduced'){
          earlyYears=Math.max(0,58-age);if(earlyYears<=0)throw new Error('已達一般月退休金起支年齡，請改選「全額月退」。');if(earlyYears>5)throw new Error('距 58 歲超過 5 年，無法選擇減額月退休金；請改選展期或一次退休金。');deduct=Math.min(.2,earlyYears*.04);startNote=`提前 ${earlyYears.toFixed(2)} 年、減額 ${(deduct*100).toFixed(2)}%`;
        }
        if(retirementMode==='deferred'){if(age>=58)throw new Error('已達一般月退休金起支年齡，無須展期；請改選全額月退。');startNote='展期至年滿 58 歲起領';}
        if(retirementMode==='mandatory')startNote='屆齡退休、退休生效日起';
      }
      const monthlyShare=benefitType==='half'?.5:benefitType==='monthly'?1:0,lumpShare=benefitType==='half'?.5:benefitType==='lump'?1:0,monthly=baseMonthly*(1-deduct)*monthlyShare,lump=fullLump*lumpShare;
      if(benefitType==='lump'){$('primaryLabel').textContent='一次退休金估計';$('primaryValue').textContent=fmt(lump);$('primaryUnit').textContent='元';$('secondaryLabel').textContent='公保一次金估計';$('secondaryValue').textContent=fmt(gpi)+' 元';$('secondaryNote').textContent=`以 ${gpiMonths.toFixed(1)} 個月估算`;}
      else if(benefitType==='half'){$('primaryLabel').textContent='二分之一月退休金估計';$('primaryValue').textContent=fmt(monthly);$('primaryUnit').textContent=`元／月（${startNote}）`;$('secondaryLabel').textContent='二分之一次退休金估計';$('secondaryValue').textContent=fmt(lump)+' 元';$('secondaryNote').textContent='另計公保一次養老給付';}
      else{$('primaryLabel').textContent='全額月退休金估計';$('primaryValue').textContent=fmt(monthly);$('primaryUnit').textContent=`元／月（${startNote}）`;$('secondaryLabel').textContent='公保一次金估計';$('secondaryValue').textContent=fmt(gpi)+' 元';$('secondaryNote').textContent=`以 ${gpiMonths.toFixed(1)} 個月估算`;}
      $('eligibility').textContent=retirementMode==='mandatory'&&age>=65?'符合一般屆齡退休年齡條件':years>=25||(years>=5&&age>=60)?'符合一般自願退休年資／年齡條件':'可能尚未符合一般自願退休條件';
      addLine('薪級路徑假設','以目前薪級為錨點、每滿一年晉一級；未個別判斷考核停晉');
      addLine('退休金種類',benefitType==='lump'?'一次退休金':benefitType==='half'?'二分之一次退休金＋二分之一月退休金':'全額月退休金');if(benefitType!=='lump')addLine('月退起領情境',startNote);addLine('適用退休年度',`民國 ${retire.y} 年`);addLine('曆年任職期間',`${monthLabel(s)}－${monthLabel(r-1)}（${raw} 個月）`);addLine('不採計留停扣除',`${uncredited} 個月`);addLine('另可併計年資',`${prior} 個月`);addLine('退休審定年資估計',`${credited} 個月（${years.toFixed(2)} 年）`);addLine('初任學歷',EDU[initial].label);events.forEach(x=>addLine(`民國 ${x.y}/${x.m} 改敘${EDU[x.target].label}`,x.point?`核定 ${x.point} 薪點`:`依法提敘 ${x.steps} 級（系統推算）`));addLine('退休時預估薪點',`${timeline.points[timeline.points.length-1]}（${fmt(last)} 元）`);addLine('平均薪額計算月數',`${avgWindow.months} 個月（目標 ${avgYears*12} 個月）`);addLine('平均薪額採計區間',`${monthLabel(avgWindow.from)}－${monthLabel(avgWindow.to)}`);addLine(`最後 ${avgYears} 年平均本（年功）薪`,`${fmt(avg)} 元`);addLine('退休金基數內涵',`${fmt(avg)} × 2＝${fmt(avg*2)} 元`);addLine('一次退休金基數',`${bases.toFixed(2)} 個基數`);addLine('全額一次退休金公式',`${fmt(avg)} × 2 × ${bases.toFixed(2)}＝${fmt(fullLump)} 元`);addLine('月退休金年資給付率',`${(pRate*100).toFixed(2)}%`);addLine('月退法定公式代入',`${fmt(avg)} × 2 × ${(pRate*100).toFixed(2)}%＝${fmt(formula)} 元`);addLine('所得替代率上限',`${(rRate*100).toFixed(2)}%`);addLine('上限公式代入',`${fmt(last)} × 2 × ${(rRate*100).toFixed(2)}%＝${fmt(ceiling)} 元`);addLine('全額月退公式與上限取低',`${fmt(baseMonthly)} 元／月`);if(deduct)addLine(`提前 ${earlyYears.toFixed(2)} 年減額`,`− ${(deduct*100).toFixed(2)}%`);if(monthlyShare)addLine('實際月退休金估計',`${fmt(monthly)} 元／月`);if(lumpShare)addLine('實際一次退休金估計',`${fmt(lump)} 元`);addLine('公保估計給付月數',`${gpiMonths.toFixed(2)} 個月（1.2 × ${years.toFixed(2)}，上限 42）`);addLine('公保一次金公式',`${fmt(last)} × ${gpiMonths.toFixed(2)}＝${fmt(gpi)} 元`);
      comparison=renderFundComparison({age,years,fullLump,baseMonthly,benefitType,retirementMode});
    }else{
      const vol=Number($('voluntary').value)/100,ret=Number($('returnRate').value)/100,acc=contributionBalance(timeline.salaries,s,excluded,vol,ret);
      const benefitLabel=benefitType==='lump'?'一次退休金':benefitType==='half'?'二分之一次退休金＋二分之一月退休金':'月退休金';
      $('primaryLabel').textContent=benefitType==='lump'?'一次領取個人專戶估計':'退休時可運用個人專戶估計';$('primaryValue').textContent=fmt(benefitType==='half'?acc.bal*.5:acc.bal);$('primaryUnit').textContent=benefitType==='half'?'元（一次領取部分）':'元';$('secondaryLabel').textContent=benefitType==='half'?'保留作月退休金部分':'其中預估投資收益';$('secondaryValue').textContent=fmt(benefitType==='half'?acc.bal*.5:acc.bal-acc.principal)+' 元';$('secondaryNote').textContent=benefitType==='lump'?`實質年報酬 ${(ret*100).toFixed(2)}%`:'月領金額須依選定攤提方式或年金保險計算';$('eligibility').textContent=years>=25||(years>=5&&age>=60)?'符合一般自願退休年資／年齡條件':'可能尚未符合一般自願退休條件';
      addLine('薪級路徑假設','以目前薪級為錨點、每滿一年晉一級；未個別判斷考核停晉');
      addLine('退休金種類',benefitLabel);addLine('月退金額說明',benefitType==='lump'?'不適用': '須依核定之定額、定率攤提或年金保險方案另行計算');addLine('曆年任職月份',`${raw} 個月`);addLine('不提撥留停月份',`${raw-acc.paidMonths} 個月`);addLine('實際提撥月數',`${acc.paidMonths} 個月`);addLine('初任學歷',EDU[initial].label);events.forEach(x=>addLine(`民國 ${x.y}/${x.m} 改敘${EDU[x.target].label}`,x.point?`核定 ${x.point} 薪點`:`依法提敘 ${x.steps} 級（系統推算）`));addLine('退休時預估薪點',`${timeline.points[timeline.points.length-1]}（${fmt(last)} 元）`);addLine('累積提撥計算基礎',`各月本（年功）薪 × 2 合計 ${fmt(acc.baseTotal)} 元`);addLine('政府提撥率／本金',`9.75%｜${fmt(acc.govPrincipal)} 元`);addLine('個人法定提繳率／本金',`5.25%｜${fmt(acc.selfPrincipal)} 元`);addLine('自願增加提繳率／本金',`${(vol*100).toFixed(2)}%｜${fmt(acc.voluntaryPrincipal)} 元`);addLine('總提撥率',`${((.15+vol)*100).toFixed(2)}%`);addLine('累積提撥本金',`${fmt(acc.principal)} 元`);addLine('實質年報酬率假設',`${(ret*100).toFixed(2)}%`);addLine('換算實質月報酬率',`${(acc.monthlyReturn*100).toFixed(4)}%`);addLine('預估投資收益',`${fmt(acc.bal-acc.principal)} 元`);addLine('退休時專戶總額',`${fmt(acc.bal)} 元`);
      comparison=renderAccountComparison(acc.bal,benefitType);
    }
    const report={
      version:2,generatedAt:new Date().toISOString(),system,systemLabel:system==='fund'?'退撫基金制':'個人專戶制',
      input:{birth,start,retire,initialEducation:EDU[initial].label,currentPoint,currentSalary:SALARY[currentPoint],priorMonths:prior,benefitType,benefitLabel:benefitType==='lump'?'一次退休金':benefitType==='half'?'二分之一次退休金＋二分之一月退休金':'全額月退休金',retirementMode,retirementModeLabel:retirementMode==='full'?'全額月退':retirementMode==='reduced'?'減額月退':retirementMode==='deferred'?'展期月退':'屆齡退休',voluntaryRate:Number($('voluntary').value)/100,returnRate:Number($('returnRate').value)/100},
      educationEvents:events.map(x=>({y:x.y,m:x.m,target:EDU[x.target].label,steps:x.steps,point:x.point})),
      leaves:leaves.map(x=>({reason:x.reason,sy:x.sy,sm:x.sm,ey:x.ey,em:x.em,credited:x.credited})),
      tenure:{rawMonths:raw,uncreditedLeaveMonths:uncredited,priorMonths:prior,creditedMonths:credited,ageMonths:r-b,allLeaveMonths:allLeave},
      result:{primaryLabel:$('primaryLabel').textContent,primaryValue:$('primaryValue').textContent,primaryUnit:$('primaryUnit').textContent,secondaryLabel:$('secondaryLabel').textContent,secondaryValue:$('secondaryValue').textContent,secondaryNote:$('secondaryNote').textContent,eligibility:$('eligibility').textContent,retirementPoint:timeline.points[timeline.points.length-1],retirementSalary:last},
      breakdown:Array.from(document.querySelectorAll('#breakdownList div')).map(row=>({label:row.querySelector('dt').textContent,value:row.querySelector('dd').textContent})),salaryTimeline:annualSummary,comparison
    };
    try{localStorage.setItem('teacherPensionReport',JSON.stringify(report));}catch(storageError){console.warn('無法儲存本機報表',storageError);}
    $('results').hidden=false;syncLiveBar();if(options.scroll)$('results').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(err){$('formError').textContent=err.message;$('liveBar').classList.remove('is-updating');$('liveBar').classList.add('has-error');$('liveChoice').textContent='資料尚未完整';$('liveLabel').textContent='請修正輸入';$('liveValue').textContent='—';$('liveUnit').textContent=err.message;$('liveEligibility').textContent='無法即時計算';if(options.scroll)$('formError').scrollIntoView({behavior:'smooth',block:'center'});}
}
function updateChoiceUI(){
  document.querySelectorAll('.choice-card').forEach(c=>c.classList.toggle('selected',c.querySelector('input').checked));
  const system=document.querySelector('[name=system]:checked').value,benefit=document.querySelector('[name=benefitType]:checked').value,modeGroup=$('retirementModeGroup');
  modeGroup.hidden=system==='account';const mode=document.querySelector('[name=retirementMode]:checked');if(benefit==='lump'&&['reduced','deferred'].includes(mode.value))document.querySelector('[name=retirementMode][value="full"]').checked=true;
  modeGroup.querySelectorAll('.choice-card').forEach(c=>c.classList.toggle('is-disabled',benefit==='lump'&&['reduced','deferred'].includes(c.querySelector('input').value)));document.querySelectorAll('.choice-card').forEach(c=>c.classList.toggle('selected',c.querySelector('input').checked));
  $('choiceHint').textContent=system==='account'?'個人專戶制的月領金額，須依退休時選定的定額、定率攤提或年金保險方案核算；本工具先呈現可運用專戶總額。':benefit==='lump'?'一次退休金不涉及減額或展期；仍可選擇一般退休或年滿 65 歲的屆齡退休情境。':'高級中等以下學校校長及教師的一般全額月退休金起支年齡以 58 歲估算；特殊身分、命令退休及原住民規定未納入自動判斷。';
}
document.querySelectorAll('[name=system]').forEach(r=>r.addEventListener('change',()=>{document.querySelectorAll('.system-card').forEach(c=>c.classList.toggle('selected',c.querySelector('input').checked));document.querySelectorAll('.account-only').forEach(x=>x.hidden=r.value!=='account');updateChoiceUI();}));
document.querySelectorAll('[name=benefitType],[name=retirementMode]').forEach(r=>r.addEventListener('change',updateChoiceUI));
$('salaryPoint').addEventListener('change',updateSalary);$('addEducation').addEventListener('click',()=>addEducation());$('addLeave').addEventListener('click',()=>addLeave());
$('voluntary').addEventListener('input',e=>$('voluntaryOut').textContent=Number(e.target.value).toFixed(2)+'%');$('returnRate').addEventListener('input',e=>$('returnOut').textContent=Number(e.target.value).toFixed(2)+'%');
let liveTimer;function scheduleLive(){clearTimeout(liveTimer);$('liveBar').classList.add('is-updating');liveTimer=setTimeout(()=>calculate(null,{scroll:false}),180);}
$('calculator').addEventListener('submit',e=>calculate(e,{scroll:true}));$('calculator').addEventListener('input',scheduleLive);$('calculator').addEventListener('change',scheduleLive);$('editAgain').addEventListener('click',()=>$('calculator').scrollIntoView({behavior:'smooth'}));
document.addEventListener('input',e=>{if(e.target.matches('input[inputmode=numeric]'))e.target.value=e.target.value.replace(/\D/g,'');});
fillSalaryPoints();addLeave({reason:'育嬰',sy:108,sm:8,ey:110,em:7,credited:false});updateChoiceUI();calculate(null,{scroll:false});
