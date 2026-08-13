(function(root,factory){
  const model=factory();
  if(typeof module==='object'&&module.exports)module.exports=model;
  else root.ServiceTenure=model;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const monthIndex=(year,month)=>Number(year)*12+Number(month)-1;
  const SCHEMES=Object.freeze(['legacy','fund','account']);
  const SERVICE_TYPES=Object.freeze(['teacher','civil','political','military','other']);
  const LEGACY_CUTOFFS=Object.freeze({
    teacher:monthIndex(85,2),
    civil:monthIndex(84,7),
    political:monthIndex(85,5),
    military:monthIndex(86,1)
  });
  const ACCOUNT_START=monthIndex(112,7);

  function assertInteger(value,label){
    const number=Number(value);
    if(!Number.isInteger(number))throw new TypeError(`${label}必須是整數月份索引。`);
    return number;
  }

  function classifyServiceMonth(at,serviceType,retirementTrack='fund',explicitScheme=null){
    const month=assertInteger(at,'服務月份');
    if(explicitScheme){
      if(!SCHEMES.includes(explicitScheme))throw new RangeError(`未知制度：${explicitScheme}`);
      return explicitScheme;
    }
    if(!SERVICE_TYPES.includes(serviceType))throw new RangeError(`未知服務類型：${serviceType}`);
    if(serviceType==='other')throw new Error('其他服務類型必須明確指定適用制度。');
    if(month<LEGACY_CUTOFFS[serviceType])return'legacy';
    if(retirementTrack==='account'){
      if(month<ACCOUNT_START)throw new Error('個人專戶軌道不得包含民國 112 年 7 月以前的未指定制度年資。');
      return'account';
    }
    if(retirementTrack!=='fund')throw new RangeError(`未知退休軌道：${retirementTrack}`);
    return'fund';
  }

  function normalizeSegment(segment,index){
    if(!segment||typeof segment!=='object')throw new TypeError(`第 ${index+1} 段年資格式錯誤。`);
    const start=assertInteger(segment.start,`第 ${index+1} 段起始`);
    const end=assertInteger(segment.end,`第 ${index+1} 段結束`);
    if(end<=start)throw new RangeError(`第 ${index+1} 段結束月份必須晚於起始月份。`);
    const serviceType=segment.serviceType||'teacher';
    if(!SERVICE_TYPES.includes(serviceType))throw new RangeError(`第 ${index+1} 段服務類型無效。`);
    if(segment.scheme&&!SCHEMES.includes(segment.scheme))throw new RangeError(`第 ${index+1} 段制度無效。`);
    return Object.freeze({
      id:String(segment.id||`segment-${index+1}`),
      serviceType,
      start,
      end,
      scheme:segment.scheme||null,
      credited:segment.credited!==false,
      contributionPaid:segment.contributionPaid!==false,
      benefitPreviouslyReceived:Boolean(segment.benefitPreviouslyReceived),
      evidence:String(segment.evidence||''),
      order:index
    });
  }

  function exclusionReason(segment,scheme){
    if(segment.benefitPreviouslyReceived)return'benefit-previously-received';
    if(!segment.credited)return'not-credited';
    if(scheme!=='legacy'&&!segment.contributionPaid)return'contribution-not-paid';
    return null;
  }

  function splitServiceSegment(segment,options={}){
    const normalized=normalizeSegment(segment,options.index||0);
    const retirementTrack=options.retirementTrack||'fund';
    const parts=[];
    for(let at=normalized.start;at<normalized.end;at++){
      const scheme=classifyServiceMonth(at,normalized.serviceType,retirementTrack,normalized.scheme);
      const reason=exclusionReason(normalized,scheme);
      const previous=parts[parts.length-1];
      if(previous&&previous.scheme===scheme&&previous.exclusionReason===reason)previous.end=at+1;
      else parts.push({
        segmentId:normalized.id,
        serviceType:normalized.serviceType,
        scheme,
        start:at,
        end:at+1,
        months:1,
        eligible:reason===null,
        exclusionReason:reason,
        evidence:normalized.evidence
      });
    }
    return parts.map(part=>Object.freeze({...part,months:part.end-part.start}));
  }

  function calculateServiceTenure({segments=[],retirementTrack='fund',legacyInput={mode:'segments'}}={}){
    if(!Array.isArray(segments))throw new TypeError('年資區段必須是陣列。');
    const normalized=segments.map(normalizeSegment);
    const monthEntries=new Map();
    const splitSegments=[];
    normalized.forEach((segment,index)=>{
      const parts=splitServiceSegment(segment,{retirementTrack,index});
      splitSegments.push(...parts);
      parts.forEach(part=>{
        for(let at=part.start;at<part.end;at++){
          if(!monthEntries.has(at))monthEntries.set(at,[]);
          monthEntries.get(at).push({...part,start:at,end:at+1,months:1,order:segment.order});
        }
      });
    });

    const overlaps=[];
    const conflicts=[];
    const counted={legacy:0,fund:0,account:0};
    const excluded={legacy:0,fund:0,account:0};
    const excludedByReason={
      'benefit-previously-received':0,
      'not-credited':0,
      'contribution-not-paid':0
    };
    const months=[];

    Array.from(monthEntries.keys()).sort((a,b)=>a-b).forEach(at=>{
      const entries=monthEntries.get(at).sort((a,b)=>a.order-b.order);
      const schemes=[...new Set(entries.map(entry=>entry.scheme))];
      if(entries.length>1)overlaps.push(Object.freeze({at,segmentIds:entries.map(entry=>entry.segmentId)}));
      if(schemes.length>1)conflicts.push(Object.freeze({at,schemes,segmentIds:entries.map(entry=>entry.segmentId)}));
      const eligibleEntries=entries.filter(entry=>entry.eligible);
      const selected=(eligibleEntries[0]||entries[0]);
      if(selected.eligible)counted[selected.scheme]++;
      else{
        excluded[selected.scheme]++;
        excludedByReason[selected.exclusionReason]++;
      }
      months.push(Object.freeze({
        at,
        scheme:selected.scheme,
        eligible:selected.eligible,
        exclusionReason:selected.exclusionReason,
        selectedSegmentId:selected.segmentId,
        overlappingSegmentIds:entries.slice(1).map(entry=>entry.segmentId)
      }));
    });

    const legacyMode=legacyInput.mode||'segments';
    let certifiedLegacyMonths=null;
    if(legacyMode==='certifiedMonths'){
      certifiedLegacyMonths=assertInteger(legacyInput.certifiedMonths,'核定舊制年資');
      if(certifiedLegacyMonths<0)throw new RangeError('核定舊制年資不能是負數。');
      counted.legacy=certifiedLegacyMonths;
    }else if(legacyMode!=='segments')throw new RangeError(`未知舊制輸入模式：${legacyMode}`);

    const creditedMonths=counted.legacy+counted.fund+counted.account;
    return Object.freeze({
      retirementTrack,
      legacyMode,
      certifiedLegacyMonths,
      counted:Object.freeze({...counted}),
      excluded:Object.freeze({...excluded}),
      excludedByReason:Object.freeze({...excludedByReason}),
      creditedMonths,
      calendarMonths:monthEntries.size,
      splitSegments:Object.freeze(splitSegments),
      months:Object.freeze(months),
      overlaps:Object.freeze(overlaps),
      conflicts:Object.freeze(conflicts),
      hasBlockingConflict:conflicts.length>0
    });
  }

  return Object.freeze({
    SCHEMES,
    SERVICE_TYPES,
    LEGACY_CUTOFFS,
    ACCOUNT_START,
    monthIndex,
    classifyServiceMonth,
    splitServiceSegment,
    calculateServiceTenure
  });
});
