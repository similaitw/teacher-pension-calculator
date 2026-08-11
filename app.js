const SALARY={190:25050,200:25820,210:26580,220:27350,230:28120,245:29270,260:30410,275:31560,290:32710,310:33860,330:35010,350:36160,370:37310,390:38460,410:39610,430:40760,450:41900,475:44970,500:46500,525:48030,550:49560,575:51100,600:52630,625:54160,650:55690,680:57220};
const LADDER=Object.keys(SALARY).map(Number);
const EDU={bachelor:{start:190,max:625},credit40:{start:245,max:625},master:{start:245,max:650},phd:{start:330,max:680}};
const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n).toLocaleString('zh-TW');
const monthIndex=(y,m)=>Number(y)*12+Number(m)-1;
const duration=(a,b)=>Math.max(0,b-a);
const ymText=months=>`${Math.floor(months/12)} 年 ${months%12} 月`;
let leaveSeq=0;

function fillSalaryPoints(){
  const cfg=EDU[$('education').value],previous=Number($('salaryPoint').value);
  $('salaryPoint').innerHTML='';
  LADDER.filter(p=>p>=cfg.start&&p<=cfg.max).reverse().forEach(p=>{
    const o=document.createElement('option');o.value=p;o.textContent=`${p}（${fmt(SALARY[p])} 元）`;$('salaryPoint').append(o);
  });
  $('salaryPoint').value=LADDER.includes(previous)&&previous>=cfg.start&&previous<=cfg.max?previous:cfg.start;
  updateSalary();
}
function updateSalary(){$('salaryAmount').textContent=`${fmt(SALARY[$('salaryPoint').value])} 元`;}
function renumberLeaves(){document.querySelectorAll('.leave-item').forEach((el,i)=>el.querySelector('.leave-number span').textContent=String(i+1).padStart(2,'0'));}
function addLeave(values={}){
  const node=$('leaveTemplate').content.firstElementChild.cloneNode(true);node.dataset.id=++leaveSeq;
  node.querySelector('.leave-reason').value=values.reason||'育嬰';
  node.querySelector('.leave-start-y').value=values.sy||'';node.querySelector('.leave-start-m').value=values.sm||'';
  node.querySelector('.leave-end-y').value=values.ey||'';node.querySelector('.leave-end-m').value=values.em||'';
  node.querySelector('.leave-credited').checked=Boolean(values.credited);
  node.querySelector('.remove-leave').addEventListener('click',()=>{node.remove();renumberLeaves();});
  $('leaveList').append(node);renumberLeaves();
}
function readRoc(prefix){return{y:Number($(prefix+'Y').value),m:Number($(prefix+'M').value)};}
function validDate(d){return Number.isInteger(d.y)&&d.y>=1&&d.y<=200&&Number.isInteger(d.m)&&d.m>=1&&d.m<=12;}
function mergeIntervals(intervals){
  const sorted=intervals.filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0]);const out=[];
  sorted.forEach(x=>{const last=out[out.length-1];if(!last||x[0]>last[1])out.push([...x]);else last[1]=Math.max(last[1],x[1]);});return out;
}
function overlapMonths(intervals,start,end){return mergeIntervals(intervals.map(([a,b])=>[Math.max(a,start),Math.min(b,end)])).reduce((s,[a,b])=>s+duration(a,b),0);}
function readLeaves(workStart,workEnd){
  const rows=[];document.querySelectorAll('.leave-item').forEach((el,i)=>{
    const sy=Number(el.querySelector('.leave-start-y').value),sm=Number(el.querySelector('.leave-start-m').value),ey=Number(el.querySelector('.leave-end-y').value),em=Number(el.querySelector('.leave-end-m').value);
    if(!sy&&!sm&&!ey&&!em)return;
    const sd={y:sy,m:sm},ed={y:ey,m:em};if(!validDate(sd)||!validDate(ed))throw new Error(`第 ${i+1} 段留停的年月不完整。`);
    const start=monthIndex(sy,sm),end=monthIndex(ey,em)+1;if(end<=start)throw new Error(`第 ${i+1} 段留停的結束年月必須晚於起始年月。`);
    if(end<=workStart||start>=workEnd)throw new Error(`第 ${i+1} 段留停不在到職至退休期間內。`);
    rows.push({reason:el.querySelector('.leave-reason').value,credited:el.querySelector('.leave-credited').checked,start,end,sy,sm,ey,em});
  });return rows;
}
function projectedAverageSalary(point,education,serviceMonths,averageYears,startMonth){
  const cfg=EDU[education],pointIdx=LADDER.indexOf(Number(point)),minIdx=LADDER.indexOf(cfg.start),maxIdx=LADDER.indexOf(cfg.max),years=Math.max(1,Math.ceil(serviceMonths/12)),path=[];
  const now=new Date(),nowRoc=monthIndex(now.getFullYear()-1911,now.getMonth()+1),anchorYear=Math.max(0,Math.min(years-1,Math.floor((nowRoc-startMonth)/12)));
  for(let i=0;i<years;i++)path.push(SALARY[LADDER[Math.max(minIdx,Math.min(maxIdx,pointIdx+i-anchorYear))]]);
  const slice=path.slice(-Math.min(path.length,averageYears));return slice.reduce((a,b)=>a+b,0)/slice.length;
}
function replacementRate(years){if(years<=15)return .39;if(years<=35)return .39+(years-15)*.015;return Math.min(.715,.69+(years-35)*.005);}
function pensionRate(years){const full=Math.floor(Math.min(years,40)),frac=Math.min(years,40)-full;let rate=full<=35?full*.02:35*.02+(full-35)*.01;return rate+frac*(full<35?.02:.01);}
function contributionBalance(months,salary,rate,annualReturn){let bal=0,principal=0;const r=Math.pow(1+annualReturn,1/12)-1;for(let i=0;i<months;i++){const c=salary*2*rate;bal=(bal+c)*(1+r);principal+=c;}return{bal,principal};}
function addLine(label,value){const row=document.createElement('div');const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);$('breakdownList').append(row);}
function renderAudit(rows){
  $('leaveAuditList').innerHTML='';if(!rows.length){$('leaveAuditList').innerHTML='<p class="empty-audit">沒有登錄留職停薪期間。</p>';return;}
  rows.forEach(r=>{const d=document.createElement('div');d.className='audit-row';d.innerHTML=`<span>${r.reason}</span><span>民國 ${r.sy}/${r.sm} — ${r.ey}/${r.em}</span><span class="${r.credited?'yes':'no'}">${r.credited?'採計（已繳付）':'不採計（扣除）'}</span>`;$('leaveAuditList').append(d);});
}
function calculate(e){
  e.preventDefault();$('formError').textContent='';
  try{
    const birth=readRoc('birth'),start=readRoc('start'),retire=readRoc('retire');if(!validDate(birth)||!validDate(start)||!validDate(retire))throw new Error('請確認出生、到職與退休年月。');
    const b=monthIndex(birth.y,birth.m),s=monthIndex(start.y,start.m),r=monthIndex(retire.y,retire.m);if(s<=b||r<=s)throw new Error('退休年月必須晚於到職年月，到職年月也必須晚於出生年月。');
    const raw=duration(s,r),leaves=readLeaves(s,r),allLeave=overlapMonths(leaves.map(x=>[x.start,x.end]),s,r),uncredited=overlapMonths(leaves.filter(x=>!x.credited).map(x=>[x.start,x.end]),s,r);
    const prior=Number($('priorYears').value||0)*12+Number($('priorMonths').value||0);if(prior<0)throw new Error('可併計年資不能是負數。');
    const credited=Math.max(0,raw-uncredited+prior),years=credited/12,age=(r-b)/12,point=Number($('salaryPoint').value),system=document.querySelector('[name=system]:checked').value;
    $('rawTenure').textContent=ymText(raw);$('leaveDeduct').textContent=ymText(uncredited);$('priorTenure').textContent=ymText(prior);$('creditedTenure').textContent=ymText(credited);$('retireAge').textContent=ymText(r-b);$('leaveTotal').textContent=ymText(allLeave);$('leaveSummary').textContent=allLeave?`其中 ${ymText(uncredited)} 不採計`:'未登錄留停';
    $('breakdownList').innerHTML='';renderAudit(leaves);
    if(system==='fund'){
      const avgYears=Math.min(15,retire.y>=118?15:Math.max(5,retire.y-103)),avg=projectedAverageSalary(point,$('education').value,raw,avgYears,s),last=SALARY[point],formula=avg*2*pensionRate(years),ceiling=last*2*replacementRate(years),baseMonthly=Math.min(formula,ceiling),earlyYears=Math.max(0,Math.min(5,58-age)),deduct=earlyYears*.04,monthly=baseMonthly*(1-deduct),gpiMonths=Math.min(42,years*1.2),gpi=last*gpiMonths;
      $('primaryLabel').textContent='每月退休金估計';$('primaryValue').textContent=fmt(monthly);$('primaryUnit').textContent=deduct?`元／月（提前 ${earlyYears.toFixed(1)} 年減額）`:'元／月';$('secondaryLabel').textContent='公保一次金估計';$('secondaryValue').textContent=fmt(gpi)+' 元';$('secondaryNote').textContent=`以 ${gpiMonths.toFixed(1)} 個月估算`;
      const qualifies=years>=25||(years>=5&&age>=60);$('eligibility').textContent=qualifies?'符合一般自願退休年資／年齡條件':'可能尚未符合一般自願退休條件';
      addLine(`最後 ${avgYears} 年平均本（年功）薪估計`,`${fmt(avg)} 元`);addLine('退休金法定公式值',`${fmt(formula)} 元／月`);addLine('所得替代率上限值',`${fmt(ceiling)} 元／月`);addLine('採用較低者',`${fmt(baseMonthly)} 元／月`);if(deduct)addLine(`提前 ${earlyYears.toFixed(1)} 年請領減額`,`− ${(deduct*100).toFixed(1)}%`);addLine('估計實領',`${fmt(monthly)} 元／月`);
    }else{
      const paidMonths=raw-uncredited,vol=Number($('voluntary').value)/100,ret=Number($('returnRate').value)/100,acc=contributionBalance(paidMonths,SALARY[point],.15+vol,ret);
      $('primaryLabel').textContent='退休時個人專戶估計';$('primaryValue').textContent=fmt(acc.bal);$('primaryUnit').textContent='元';$('secondaryLabel').textContent='其中預估投資收益';$('secondaryValue').textContent=fmt(acc.bal-acc.principal)+' 元';$('secondaryNote').textContent=`實質年報酬 ${(ret*100).toFixed(2)}%`;
      $('eligibility').textContent=years>=25||(years>=5&&age>=60)?'符合一般自願退休年資／年齡條件':'可能尚未符合一般自願退休條件';
      addLine('實際提撥月數',`${paidMonths} 個月`);addLine('法定＋自願提撥率',`${((.15+vol)*100).toFixed(2)}%`);addLine('累積提撥本金',`${fmt(acc.principal)} 元`);addLine('預估投資收益',`${fmt(acc.bal-acc.principal)} 元`);
    }
    $('results').hidden=false;$('results').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(err){$('formError').textContent=err.message;$('formError').scrollIntoView({behavior:'smooth',block:'center'});}
}
document.querySelectorAll('[name=system]').forEach(r=>r.addEventListener('change',()=>{document.querySelectorAll('.system-card').forEach(c=>c.classList.toggle('selected',c.querySelector('input').checked));document.querySelectorAll('.account-only').forEach(x=>x.hidden=r.value!=='account');}));
$('education').addEventListener('change',fillSalaryPoints);$('salaryPoint').addEventListener('change',updateSalary);$('addLeave').addEventListener('click',()=>addLeave());
$('voluntary').addEventListener('input',e=>$('voluntaryOut').textContent=Number(e.target.value).toFixed(2)+'%');$('returnRate').addEventListener('input',e=>$('returnOut').textContent=Number(e.target.value).toFixed(2)+'%');
$('calculator').addEventListener('submit',calculate);$('editAgain').addEventListener('click',()=>$('calculator').scrollIntoView({behavior:'smooth'}));
document.addEventListener('input',e=>{if(e.target.matches('input[inputmode=numeric]'))e.target.value=e.target.value.replace(/\D/g,'');});
fillSalaryPoints();addLeave({reason:'育嬰',sy:108,sm:8,ey:110,em:7,credited:false});
