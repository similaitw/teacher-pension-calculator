(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ComparisonEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function assertNumber(value,label){if(!Number.isFinite(value))throw new TypeError(`${label} 必須是有限數字`);}

  function enumeratePensionScenarios({retirementAge,years,benefits,selectedType='monthly',selectedMode='full'}){
    assertNumber(retirementAge,'退休年齡');assertNumber(years,'年資');
    const scenarios=[];
    const add=(type,mode,label,startAge,deduction=0)=>{
      const amount=benefits[type]||{};
      scenarios.push({
        id:`${type}-${mode}`,type,mode,label,retirementAge,startAge,deduction,
        lump:Math.max(0,Number(amount.lump)||0),
        monthly:Math.max(0,Number(amount.monthly)||0)*(1-deduction),
        selected:type===selectedType&&(type==='lump'||mode===selectedMode)
      });
    };
    add('lump',retirementAge>=65?'mandatory':'full',retirementAge>=65?'一次退｜屆齡':'一次退｜一般',retirementAge);
    if(years>=15){
      ['half','monthly'].forEach(type=>{
        const name=type==='half'?'半月退':'月退';
        if(retirementAge>=65)add(type,'mandatory',`${name}｜屆齡`,retirementAge);
        else if(retirementAge>=58)add(type,'full',`${name}｜全額`,retirementAge);
        else{
          if(retirementAge>=53)add(type,'reduced',`${name}｜減額`,retirementAge,Math.min(.2,(58-retirementAge)*.04));
          add(type,'deferred',`${name}｜展期`,58);
        }
      });
    }
    return scenarios;
  }

  function cumulativeAt(scenario,targetAge,lumpReturnRate=0){
    assertNumber(targetAge,'目標年齡');assertNumber(lumpReturnRate,'一次金年報酬率');
    if(targetAge<scenario.retirementAge)return 0;
    const elapsed=Math.max(0,targetAge-scenario.retirementAge);
    const lump=scenario.lump*Math.pow(1+lumpReturnRate,elapsed);
    const monthlyMonths=Math.max(0,targetAge-scenario.startAge)*12;
    return lump+scenario.monthly*monthlyMonths;
  }

  function compareAtTargets(scenarios,targets,lumpReturnRate=0){
    return targets.map(age=>{
      const values=scenarios.map(s=>({id:s.id,value:cumulativeAt(s,age,lumpReturnRate)}));
      return{age,values,max:Math.max(0,...values.map(x=>x.value))};
    });
  }

  function findCrossover(first,second,{startAge=Math.min(first.retirementAge,second.retirementAge),endAge=100,lumpReturnRate=0}={}){
    let previous=null,sawFirstLead=false;
    for(let month=0;month<=Math.round((endAge-startAge)*12);month++){
      const age=startAge+month/12,diff=cumulativeAt(second,age,lumpReturnRate)-cumulativeAt(first,age,lumpReturnRate);
      if(diff<0)sawFirstLead=true;
      if(sawFirstLead&&diff>=0){return{crossed:true,age,diff,previousDiff:previous===null?diff:previous};}
      previous=diff;
    }
    return{crossed:false,age:null,diff:previous,previousDiff:previous,sawFirstLead};
  }

  function monthlyCashAt(scenario,at,{includeWorkIncome=true}={}){
    if(at>=scenario.retirementMonth)return Math.max(0,Number(scenario.monthlyPension)||0);
    if(!includeWorkIncome)return 0;
    const source=scenario.workIncome;
    return Math.max(0,typeof source==='function'?Number(source(at))||0:Number(source)||0);
  }

  function sumMonthlyCash(scenario,startMonth,endMonth,options={}){
    let total=0;
    for(let at=startMonth;at<endMonth;at++)total+=monthlyCashAt(scenario,at,options);
    return total;
  }

  return{enumeratePensionScenarios,cumulativeAt,compareAtTargets,findCrossover,monthlyCashAt,sumMonthlyCash};
});
