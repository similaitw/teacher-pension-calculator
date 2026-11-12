const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;

test('預設基金制即時計算、手機寬度與報表一致',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#primaryValue')).toHaveText('75,182');
  await page.setViewportSize({width:360,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
  await page.goto('/report.html');
  await expect(page.locator('#reportPrimaryValue')).toHaveText('75,182');
  await expect(page.locator('.report-toolbar h1')).toHaveText('我的報表');
  expect(await page.locator('.report-jump a').evaluateAll(links=>links.map(link=>link.getAttribute('href')))).toEqual(['#dictionary']);
  expect(await page.locator('.report-main').evaluate(main=>Array.from(main.children).sort((a,b)=>getComputedStyle(a).order-getComputedStyle(b).order).slice(0,3).map(node=>node.id||node.classList[0]))).toEqual(['report-toolbar','generatedReport','dictionary']);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
});

test('舊制與核定優存本金即時計算並同步報表',async({page})=>{
  await page.goto('/');
  await page.locator('#hasLegacy').check();
  await page.locator('#legacyYears').fill('10');
  await page.locator('[name="preferentialInputMode"][value="principal"]').check();
  await page.locator('#preferentialPrincipal').fill('1200000');
  await page.locator('#preferentialAnnualRate').fill('3');
  await expect(page.locator('#primaryValue')).toHaveText('79,637');
  await expect(page.locator('#comparisonRows')).toContainText('6,195,540 元');
  await expect(page.locator('#breakdownList')).toContainText('1,200,000 元 × 核定年利率 3.00% ÷ 12＝3,000 元／月');
  await page.goto('/report.html');
  await expect(page.locator('#reportPrimaryValue')).toHaveText('79,637');
  await expect(page.locator('#schemeData')).toContainText('本金 1,200,000 元 × 3.00%');
  await expect(page.locator('#pendingItems')).toContainText('待確認：優惠存款核定本金與核定年利率');
});

test('55 歲、58 歲與 65 歲只列出合法情境',async({page})=>{
  await page.goto('/');
  await page.locator('#retireY').selectOption('121');
  await expect(page.locator('#comparisonRows tr')).toHaveCount(5);
  await expect(page.locator('#comparisonRows')).toContainText('月退｜減額');
  await expect(page.locator('#comparisonRows')).toContainText('月退｜展期');
  await page.locator('#retireY').selectOption('130');
  await page.locator('#retireM').selectOption('12');
  await expect(page.locator('#comparisonRows tr')).toHaveCount(3);
  await expect(page.locator('#comparisonRows')).toContainText('月退｜屆齡');
  await expect(page.locator('[name="retirementMode"][value="mandatory"]')).toBeChecked();
});

test('首頁沒有嚴重無障礙問題且靜態資源維持輕量',async({page})=>{
  await page.goto('/');
  const results=await new AxeBuilder({page}).analyze();
  expect(results.violations.filter(item=>['critical','serious'].includes(item.impact))).toEqual([]);
  const resourceBytes=await page.evaluate(()=>performance.getEntriesByType('resource').reduce((sum,item)=>sum+(item.transferSize||0),0));
  expect(resourceBytes).toBeLessThan(500000);
});

test('已領退離給與期間鎖定不採計並同步明細與報表',async({page})=>{
  await page.goto('/');
  const before=await page.locator('#creditedTenure').textContent();
  await page.locator('#addLeave').click();
  const item=page.locator('.leave-item').last();
  await item.locator('.leave-reason').selectOption('曾領資遣給與');
  await expect(item.locator('.leave-credited')).toBeDisabled();
  await expect(item.locator('.leave-credited')).not.toBeChecked();
  await item.locator('.leave-start-y').fill('100');
  await item.locator('.leave-start-m').fill('8');
  await item.locator('.leave-end-y').fill('101');
  await item.locator('.leave-end-m').fill('7');
  await expect(page.locator('#leaveAuditList')).toContainText('不採計（已領給與）');
  await expect(page.locator('#leaveSummary')).toContainText('另有已領給與 1 年');
  await expect(page.locator('#creditedTenure')).not.toHaveText(before);
  await page.goto('/report.html');
  await expect(page.locator('#leaveData')).toContainText('不採計（已領給與）');
  await expect(page.locator('#pendingItems')).toContainText('已領退離給與期間是否已依規定繳回');
});
