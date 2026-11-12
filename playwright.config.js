const {defineConfig}=require('@playwright/test');

// 埠號可用 E2E_PORT 覆寫；預設不沿用既有伺服器，避免本機同埠的其他網站被誤測。
// 若確定已手動啟動本站，可設 E2E_REUSE_SERVER=1 沿用。
const port=Number(process.env.E2E_PORT)||4173;
const baseURL=`http://127.0.0.1:${port}`;

module.exports=defineConfig({
  testDir:'./tests/e2e',
  timeout:30000,
  use:{baseURL,headless:true,viewport:{width:1280,height:800}},
  webServer:{command:`npx http-server . -p ${port} -c-1`,url:baseURL,reuseExistingServer:process.env.E2E_REUSE_SERVER==='1',timeout:30000},
  reporter:'line'
});
