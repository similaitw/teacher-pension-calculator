'use strict';

const fs=require('node:fs');
const path=require('node:path');
const rules=require('../pension-rules.js');
const tenureModel=require('../service-tenure.js');

const REQUIRED_CATEGORIES=Object.freeze(['pure-fund','mixed','leave-or-combined']);
const REQUIRED_EXPECTED_FIELDS=Object.freeze([
  'creditedMonths','legacyMonths','fundMonths','accountMonths',
  'averageSalary','finalSalary','lump','monthly','totalDeduction'
]);
const MONTH_FIELDS=new Set(['creditedMonths','legacyMonths','fundMonths','accountMonths']);

function finiteNonNegative(value,label){
  const number=Number(value);
  if(!Number.isFinite(number)||number<0)throw new TypeError(`${label}必須是非負數。`);
  return number;
}

function resolveTenure(input){
  if(Array.isArray(input.segments)){
    const result=tenureModel.calculateServiceTenure({
      segments:input.segments,
      retirementTrack:input.retirementTrack||'fund',
      legacyInput:input.legacyInput||{mode:'segments'}
    });
    if(result.hasBlockingConflict)throw new Error('年資區段含跨制度衝突，無法進行正式案例比對。');
    return {
      creditedMonths:result.creditedMonths,
      legacyMonths:result.counted.legacy,
      fundMonths:result.counted.fund,
      accountMonths:result.counted.account
    };
  }
  const legacyMonths=finiteNonNegative(input.legacyMonths||0,'舊制年資月數');
  const fundMonths=finiteNonNegative(input.fundMonths||0,'基金制年資月數');
  const accountMonths=finiteNonNegative(input.accountMonths||0,'個人專戶年資月數');
  if(![legacyMonths,fundMonths,accountMonths].every(Number.isInteger))throw new TypeError('年資月數必須是整數。');
  return {creditedMonths:legacyMonths+fundMonths+accountMonths,legacyMonths,fundMonths,accountMonths};
}

function calculateCase(testCase){
  if(!testCase||typeof testCase!=='object')throw new TypeError('案例必須是 JSON 物件。');
  if(!String(testCase.id||'').trim())throw new Error('id 不得空白。');
  if(!REQUIRED_CATEGORIES.includes(testCase.category))throw new RangeError(`未知案例類別：${testCase.category||'（空白）'}`);
  if(testCase.source?.anonymized!==true)throw new Error('source.anonymized 必須明確設為 true。');
  if(!String(testCase.source?.document||'').trim())throw new Error('source.document 不得空白。');
  const input=testCase.input||{};
  const tenure=resolveTenure(input);
  if(tenure.accountMonths>0)throw new Error('正式案例比對器目前不計算個人專戶給與；accountMonths 必須為 0。');
  if(testCase.category==='pure-fund'&&tenure.legacyMonths!==0)throw new Error('pure-fund 案例的 legacyMonths 必須為 0。');
  if(testCase.category==='mixed'&&(tenure.legacyMonths===0||tenure.fundMonths===0))throw new Error('mixed 案例必須同時有舊制與基金制年資。');
  if(testCase.category==='leave-or-combined'&&!Array.isArray(input.segments))throw new Error('leave-or-combined 案例必須提供 segments 逐段年資。');
  const averageSalary=finiteNonNegative(input.averageSalary,'平均薪額');
  const finalSalary=finiteNonNegative(input.finalSalary,'最後在職薪額');
  const common={
    legacyMonths:tenure.legacyMonths,
    fundMonths:tenure.fundMonths,
    averageSalary,
    finalSalary,
    preferentialInterest:finiteNonNegative(input.preferentialInterest||0,'每月優惠存款利息'),
    qualifiedForMonthlyBefore2018:Boolean(input.qualifiedForMonthlyBefore2018),
    specialLongServiceTeacher:Boolean(input.specialLongServiceTeacher)
  };
  let lump;
  let monthly;
  let totalDeduction;
  if(tenure.legacyMonths===0){
    const result=rules.calculateFundPension({years:tenure.fundMonths/12,averageSalary,finalSalary});
    lump=result.lump;
    monthly=result.monthly;
    totalDeduction=result.statutoryMonthly-result.monthly;
  }else{
    const lumpBest=rules.findMostFavorableSelection({...common,benefitType:'lump',objective:'lump'});
    const monthlyBest=rules.findMostFavorableSelection({...common,benefitType:'monthly',objective:'monthly'});
    if(!lumpBest||!monthlyBest)throw new Error('此案例不符合一般一次退及月退資格，無法完成兩種給與比對。');
    lump=lumpBest.grossLump;
    monthly=monthlyBest.netMonthly;
    totalDeduction=monthlyBest.ceiling?.deductions.total||0;
  }
  return Object.freeze({...tenure,averageSalary,finalSalary,lump,monthly,totalDeduction});
}

function compareCase(testCase){
  const actual=calculateCase(testCase);
  const expected=testCase.expected||{};
  const missing=REQUIRED_EXPECTED_FIELDS.filter(field=>!Object.hasOwn(expected,field));
  if(missing.length)throw new Error(`expected 缺少欄位：${missing.join('、')}`);
  const moneyTolerance=finiteNonNegative(testCase.tolerance?.money??1,'金額允許誤差');
  const monthTolerance=finiteNonNegative(testCase.tolerance?.months??0,'月份允許誤差');
  const comparisons=REQUIRED_EXPECTED_FIELDS.map(field=>{
    const expectedValue=finiteNonNegative(expected[field],`expected.${field}`);
    const difference=actual[field]-expectedValue;
    const tolerance=MONTH_FIELDS.has(field)?monthTolerance:moneyTolerance;
    return Object.freeze({field,expected:expectedValue,actual:actual[field],difference,tolerance,passed:Math.abs(difference)<=tolerance});
  });
  return Object.freeze({id:String(testCase.id||'未命名案例'),category:testCase.category,passed:comparisons.every(item=>item.passed),actual,comparisons});
}

function validateCaseCollection(testCases){
  const errors=[];
  if(!Array.isArray(testCases))return {passed:false,errors:['案例集合必須是陣列。'],results:[]};
  const categories=new Set(testCases.map(item=>item?.category));
  REQUIRED_CATEGORIES.forEach(category=>{if(!categories.has(category))errors.push(`缺少必要案例類別：${category}`);});
  if(testCases.length<3)errors.push(`正式案例至少需要 3 份，目前只有 ${testCases.length} 份。`);
  const results=[];
  testCases.forEach((testCase,index)=>{
    try{
      const result=compareCase(testCase);
      results.push(result);
      if(!result.passed)errors.push(`案例 ${result.id} 的正式數值比對未通過。`);
    }catch(error){errors.push(`第 ${index+1} 份案例無法驗證：${error.message}`);}
  });
  return {passed:errors.length===0,errors,results};
}

function loadCases(directory){
  if(!fs.existsSync(directory))return [];
  return fs.readdirSync(directory)
    .filter(name=>name.endsWith('.json')&&!name.endsWith('.example.json'))
    .sort()
    .map(name=>JSON.parse(fs.readFileSync(path.join(directory,name),'utf8')));
}

function printReport(report){
  report.results.forEach(result=>{
    console.log(`\n${result.passed?'PASS':'FAIL'} ${result.id} [${result.category}]`);
    result.comparisons.forEach(item=>console.log(`  ${item.passed?'✓':'✗'} ${item.field}: 預期 ${item.expected}，實算 ${item.actual}，差額 ${item.difference}（容許 ${item.tolerance}）`));
  });
  if(report.errors.length){
    console.error('\n正式發布閘門未通過：');
    report.errors.forEach(error=>console.error(`- ${error}`));
  }
}

if(require.main===module){
  const directory=path.resolve(process.argv[2]||path.join(__dirname,'..','validation-cases'));
  const report=validateCaseCollection(loadCases(directory));
  printReport(report);
  process.exitCode=report.passed?0:1;
}

module.exports={REQUIRED_CATEGORIES,REQUIRED_EXPECTED_FIELDS,resolveTenure,calculateCase,compareCase,validateCaseCollection,loadCases};
