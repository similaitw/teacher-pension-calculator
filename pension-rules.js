(function(root,factory){
  const rules=factory();
  if(typeof module==='object'&&module.exports)module.exports=rules;
  else root.PensionRules=rules;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const RULES_VERSION='MOE-114.12.26';
  const LEGAL_RULES=Object.freeze({
    version:RULES_VERSION,
    law:'公立學校教職員退休資遣撫卹條例',
    amendedRocDate:'114-12-26',
    amendedDate:'2025-12-26',
    source:'https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001661',
    appendixSource:'https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001661',
    averageSalaryBasis:'第 28 條第 2 項附表一',
    fundBenefitFormula:'第 30 條',
    replacementRateBasis:'第 37、38 條及附表三（統一採民國 112 年欄）',
    legacyBaseContent:'第 28 條（舊制一次退加 930 元；舊制月退另十足發給 930 元）'
  });

  const AVERAGE_SALARY_YEARS=Object.freeze({
    107:5,108:5,109:6,110:7,111:8,112:9,
    113:10,114:11,115:12,116:13,117:14,118:15
  });

  function finiteNumber(value,label){
    const number=Number(value);
    if(!Number.isFinite(number))throw new TypeError(`${label}必須是有限數值。`);
    return number;
  }

  function nonNegative(value,label){
    const number=finiteNumber(value,label);
    if(number<0)throw new RangeError(`${label}不能是負數。`);
    return number;
  }

  function averageSalaryYears(retirementRocYear){
    const year=Math.trunc(finiteNumber(retirementRocYear,'退休民國年度'));
    if(year<=108)return 5;
    if(year>=118)return 15;
    return AVERAGE_SALARY_YEARS[year];
  }

  function replacementRate(years){
    const credited=Math.min(40,Math.max(15,nonNegative(years,'退休年資')));
    if(credited<=35)return .39+(credited-15)*.015;
    return .69+(credited-35)*.005;
  }

  function fundMonthlyPensionRate(years){
    const credited=Math.min(40,nonNegative(years,'退休年資'));
    if(credited<=35)return credited*.02;
    return .70+(credited-35)*.01;
  }

  function fundLumpSumBases(years){
    const credited=Math.min(42,nonNegative(years,'退休年資'));
    if(credited<35)return credited*1.5;
    return Math.min(60,53+(credited-35));
  }

  function pensionBaseContents({averageSalary,finalSalary,qualifiedForMonthlyBefore2018=false}){
    const average=nonNegative(averageSalary,'平均薪額');
    const final=nonNegative(finalSalary,'最後在職薪額');
    const salaryBasis=qualifiedForMonthlyBefore2018?final:average;
    return Object.freeze({
      salaryBasis,
      legacyLump:salaryBasis+930,
      legacyMonthly:salaryBasis,
      legacyMonthlyFlatAddition:930,
      fund:salaryBasis*2
    });
  }

  function calculateFundPension({years,averageSalary,finalSalary}){
    const average=nonNegative(averageSalary,'平均薪額');
    const final=nonNegative(finalSalary,'最後在職薪額');
    const monthlyRate=fundMonthlyPensionRate(years);
    const incomeReplacementRate=replacementRate(years);
    const baseContents=pensionBaseContents({averageSalary:average,finalSalary:final});
    const statutoryMonthly=baseContents.fund*monthlyRate;
    const replacementCeiling=final*2*incomeReplacementRate;
    const lumpBases=fundLumpSumBases(years);
    return Object.freeze({
      averageSalary:average,
      finalSalary:final,
      baseContents,
      monthlyRate,
      incomeReplacementRate,
      statutoryMonthly,
      replacementCeiling,
      monthly:Math.min(statutoryMonthly,replacementCeiling),
      lumpBases,
      lump:baseContents.fund*lumpBases
    });
  }

  return Object.freeze({
    RULES_VERSION,
    LEGAL_RULES,
    AVERAGE_SALARY_YEARS,
    averageSalaryYears,
    replacementRate,
    fundMonthlyPensionRate,
    fundLumpSumBases,
    pensionBaseContents,
    calculateFundPension
  });
});
