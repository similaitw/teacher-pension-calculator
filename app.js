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
function replacementRate(years){if(years<=15)return .39;if(years<=35)return .39+(years-15)*.015;return Math.min(.715,.69+(years-35)*.005);}
function pensionRate(years){const full=Math.floor(Math.min(years,40)),frac=Math.min(years,40)-full;let rate=full<=35?full*.02:35*.02+(full-35)*.01;return rate+frac*(full<35?.02:.01);}
function contributionBalance(salaries,start,excluded,rate,annualReturn){
  let bal=0,principal=0,paidMonths=0;const monthlyReturn=Math.pow(1+annualReturn,1/12)-1,merged=mergeIntervals(excluded);
  salaries.forEach((salary,i)=>{const at=start+i,isExcluded=merged.some(([a,b])=>at>=a&&at<b);if(!isExcluded){const c=salary*2*rate;bal=(bal+c)*(1+monthlyReturn);principal+=c;paidMonths++;}else bal*=1+monthlyReturn;});return{bal,principal,paidMonths};
}
function addLine(label,value){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);$('breakdownList').append(row);}
function renderAudit(rows){
  $('leaveAuditList').innerHTML='';if(!rows.length){$('leaveAuditList').innerHTML='<p class="empty-audit">沒有登錄留職停薪期間。</p>';return;}
  rows.forEach(r=>{const d=document.createElement('div');d.className='audit-row';d.innerHTML=`<span>${r.reason}</span><span>民國 ${r.sy}/${r.sm} — ${r.ey}/${r.em}</span><span class="${r.credited?'yes':'no'}">${r.credited?'採計（已繳付）':'不採計（扣除）'}</span>`;$('leaveAuditList').append(d);});
}
function calculate(e){
  e.preventDefault();$('formError').textContent='';
  try{
    const birth=readRoc('birth'),start=readRoc('start'),retire=readRoc('retire');if(!validDate(birth)||!validDate(start)||!validDate(retire))throw new Error('請確認出生、到職與退休年月。');
    const b=monthIndex(birth.y,birth.m),s=monthIndex(start.y,start.m),r=monthIndex(retire.y,retire.m);if(s<=b||r<=s)throw new Error('退休年月必須晚於到職年月，到職年月也必須晚於出生年月。');
    const initial=$('education').value,events=readEducationEvents(initial,s,r),leaves=readLeaves(s,r),raw=duration(s,r),allLeave=overlapMonths(leaves.map(x=>[x.start,x.end]),s,r),excluded=leaves.filter(x=>!x.credited).map(x=>[x.start,x.end]),uncredited=overlapMonths(excluded,s,r);
    const prior=Number($('priorYears').value||0)*12+Number($('priorMonths').value||0);if(prior<0)throw new Error('可併計年資不能是負數。');
    const credited=Math.max(0,raw-uncredited+prior),years=credited/12,age=(r-b)/12,currentPoint=Number($('salaryPoint').value),timeline=buildSalaryTimeline(initial,events,s,r,currentPoint),last=timeline.salaries[timeline.salaries.length-1],system=document.querySelector('[name=system]:checked').value;
    $('rawTenure').textContent=ymText(raw);$('leaveDeduct').textContent=ymText(uncredited);$('priorTenure').textContent=ymText(prior);$('creditedTenure').textContent=ymText(credited);$('retireAge').textContent=ymText(r-b);$('leaveTotal').textContent=ymText(allLeave);$('leaveSummary').textContent=allLeave?`其中 ${ymText(uncredited)} 不採計`:'未登錄留停';$('breakdownList').innerHTML='';renderAudit(leaves);
    if(system==='fund'){
      const avgYears=Math.min(15,retire.y>=118?15:Math.max(5,retire.y-103)),slice=timeline.salaries.slice(-avgYears*12),avg=slice.reduce((a,v)=>a+v,0)/slice.length,formula=avg*2*pensionRate(years),ceiling=last*2*replacementRate(years),baseMonthly=Math.min(formula,ceiling),earlyYears=Math.max(0,Math.min(5,58-age)),deduct=earlyYears*.04,monthly=baseMonthly*(1-deduct),gpiMonths=Math.min(42,years*1.2),gpi=last*gpiMonths;
      $('primaryLabel').textContent='每月退休金估計';$('primaryValue').textContent=fmt(monthly);$('primaryUnit').textContent=deduct?`元／月（提前 ${earlyYears.toFixed(1)} 年減額）`:'元／月';$('secondaryLabel').textContent='公保一次金估計';$('secondaryValue').textContent=fmt(gpi)+' 元';$('secondaryNote').textContent=`以 ${gpiMonths.toFixed(1)} 個月估算`;$('eligibility').textContent=years>=25||(years>=5&&age>=60)?'符合一般自願退休年資／年齡條件':'可能尚未符合一般自願退休條件';
      addLine('初任學歷',EDU[initial].label);events.forEach(x=>addLine(`民國 ${x.y}/${x.m} 改敘${EDU[x.target].label}`,x.point?`核定 ${x.point} 薪點`:`依法提敘 ${x.steps} 級（系統推算）`));addLine('退休時預估薪點',`${timeline.points[timeline.points.length-1]}（${fmt(last)} 元）`);addLine(`最後 ${avgYears} 年平均本（年功）薪估計`,`${fmt(avg)} 元`);addLine('退休金法定公式值',`${fmt(formula)} 元／月`);addLine('所得替代率上限值',`${fmt(ceiling)} 元／月`);addLine('採用較低者',`${fmt(baseMonthly)} 元／月`);if(deduct)addLine(`提前 ${earlyYears.toFixed(1)} 年請領減額`,`− ${(deduct*100).toFixed(1)}%`);addLine('估計實領',`${fmt(monthly)} 元／月`);
    }else{
      const vol=Number($('voluntary').value)/100,ret=Number($('returnRate').value)/100,acc=contributionBalance(timeline.salaries,s,excluded,.15+vol,ret);
      $('primaryLabel').textContent='退休時個人專戶估計';$('primaryValue').textContent=fmt(acc.bal);$('primaryUnit').textContent='元';$('secondaryLabel').textContent='其中預估投資收益';$('secondaryValue').textContent=fmt(acc.bal-acc.principal)+' 元';$('secondaryNote').textContent=`實質年報酬 ${(ret*100).toFixed(2)}%`;$('eligibility').textContent=years>=25||(years>=5&&age>=60)?'符合一般自願退休年資／年齡條件':'可能尚未符合一般自願退休條件';
      addLine('初任學歷',EDU[initial].label);events.forEach(x=>addLine(`民國 ${x.y}/${x.m} 改敘${EDU[x.target].label}`,x.point?`核定 ${x.point} 薪點`:`依法提敘 ${x.steps} 級（系統推算）`));addLine('退休時預估薪點',`${timeline.points[timeline.points.length-1]}（${fmt(last)} 元）`);addLine('實際提撥月數',`${acc.paidMonths} 個月`);addLine('法定＋自願提撥率',`${((.15+vol)*100).toFixed(2)}%`);addLine('累積提撥本金',`${fmt(acc.principal)} 元`);addLine('預估投資收益',`${fmt(acc.bal-acc.principal)} 元`);
    }
    $('results').hidden=false;$('results').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(err){$('formError').textContent=err.message;$('formError').scrollIntoView({behavior:'smooth',block:'center'});}
}
document.querySelectorAll('[name=system]').forEach(r=>r.addEventListener('change',()=>{document.querySelectorAll('.system-card').forEach(c=>c.classList.toggle('selected',c.querySelector('input').checked));document.querySelectorAll('.account-only').forEach(x=>x.hidden=r.value!=='account');}));
$('salaryPoint').addEventListener('change',updateSalary);$('addEducation').addEventListener('click',()=>addEducation());$('addLeave').addEventListener('click',()=>addLeave());
$('voluntary').addEventListener('input',e=>$('voluntaryOut').textContent=Number(e.target.value).toFixed(2)+'%');$('returnRate').addEventListener('input',e=>$('returnOut').textContent=Number(e.target.value).toFixed(2)+'%');
$('calculator').addEventListener('submit',calculate);$('editAgain').addEventListener('click',()=>$('calculator').scrollIntoView({behavior:'smooth'}));
document.addEventListener('input',e=>{if(e.target.matches('input[inputmode=numeric]'))e.target.value=e.target.value.replace(/\D/g,'');});
fillSalaryPoints();addLeave({reason:'育嬰',sy:108,sm:8,ey:110,em:7,credited:false});
