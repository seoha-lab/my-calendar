const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const ORIGIN = 'http://127.0.0.1:3001';
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'auth-pilot@example.invalid',
  created_at: '2026-10-15T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
};
const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const token = [
  encode({alg:'HS256',typ:'JWT'}),
  encode({aud:'authenticated', sub:user.id, role:'authenticated',email:user.email, exp:Math.floor(Date.now()/1000)+3600}),
  encode({sig:'test-only'})
].join('.');

async function run() {
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ headless:true, args:['--no-sandbox'], ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  const context = await browser.newContext({viewport:{width:1200,height:860}});
  const page = await context.newPage();
  const errors = [];
  const restWrites = [];
  page.on('pageerror', e=>errors.push(e.message));

  const stamp = '2026-10-17T00:00:00.000Z';
  const cloud = {
    calendars: [{user_id:user.id,id:'local',title:'내 캘린더',enabled:true,kind:'local',read_only:false,updated_at:stamp,deleted_at:null}],
    categories: [], shift_types: [], task_ranges: [], shift_assignments: [], user_preferences: [],
    tasks: [{user_id:user.id,id:'cloud-seed',calendar_id:'local',title:'클라우드에서 온 일정',description:null,location:null,category_id:'other',deadline_at:null,estimated_minutes:null,priority:'medium',stage:'todo',checked:false,completed_at:null,start_at:null,end_at:null,all_day:false,is_event:false,hidden_on_calendar:false,linked_to:[],parent_id:null,sub_tasks:[],sort_order:0,revision:1,created_at:stamp,updated_at:stamp,deleted_at:null}],
  };

  const installRoutes = async(target) => target.route('https://qglwymsqskagoobpvcna.supabase.co/**', async(route)=>{

    const req=route.request();
    const url=new URL(req.url());
    const body = req.postDataJSON?.() || {};
    const json=(data,status=200)=>route.fulfill({
      status, contentType:'application/json',
      headers:{'access-control-allow-origin':'*','access-control-allow-credentials':'true'},
      body:JSON.stringify(data),
    });

    if(url.pathname==='/auth/v1/token' && url.searchParams.get('grant_type')==='password') {
      if(body.password!=='validPassword789!') return json({code:'invalid_credentials',msg:'Invalid login credentials'},400);
      return json({access_token:token,token_type:'bearer',expires_in:3600,refresh_token:'daymo-test-refresh-token',user});
    }
    if(url.pathname==='/auth/v1/user' && req.method()==='GET') return json(user);
    if(url.pathname==='/auth/v1/signup') return json({user,session:null});
    if(url.pathname==='/auth/v1/recover') return json({});
    if(url.pathname==='/auth/v1/logout') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*'}});
    if(url.pathname==='/rest/v1/profiles') return json({id:user.id,created_at:user.created_at});
    if(url.pathname.startsWith('/rest/v1/')) {
      const table=url.pathname.split('/').pop();
      if(!(table in cloud)) return json({message:'Unknown table '+table},404);
      if(req.method()==='GET') return json(cloud[table]);
      if(req.method()==='POST') {
        restWrites.push({table,method:'POST',body});
        const incoming=Array.isArray(body)?body:[body];
        for(const row of incoming) {
          const index=cloud[table].findIndex(item=>item.id ? item.id===row.id : item.user_id===row.user_id);
          if(index>=0) cloud[table][index]={...cloud[table][index],...row}; else cloud[table].push(row);
        }
        return json(incoming,201);
      }
      if(req.method()==='PATCH') {
        restWrites.push({table,method:'PATCH',body,url:req.url()});
        const id=url.searchParams.get('id')?.replace(/^eq\./,'');
        const index=cloud[table].findIndex(item=>item.id===id);
        if(index>=0) cloud[table][index]={...cloud[table][index],...body};
        return json(index>=0?[cloud[table][index]]:[]);
      }
      if(req.method()==='DELETE') return json([]);
    }
    if(url.pathname==='/auth/v1/token' && url.searchParams.get('grant_type')==='refresh_token') {
      return json({access_token:token,token_type:'bearer',expires_in:3600,refresh_token:'daymo-test-refresh-token',user});
    }
    return json({message:'No mocked API route: '+url.pathname},404);
  });
  await installRoutes(page);

  try {
    await page.goto(ORIGIN+'/',{waitUntil:'networkidle'});
    try {
      await page.getByText('Daymo에 로그인해 주세요').waitFor({timeout:15000});
    } catch (error) {
      throw new Error(`${error.message}\nbody=${await page.locator('body').innerText()}\npageErrors=${JSON.stringify(errors)}`);
    }
    assert.equal(await page.getByText('할 일 보드 보기').count(),0,'No local SQLite task board before authentication');
    console.log('PASS unauthenticated gate protects local account data');

    await page.goto(ORIGIN+'/login',{waitUntil:'networkidle'});
    assert.equal(await page.getByRole('heading',{name:'이메일 로그인'}).count(),1);
    console.log('PASS login page');

    await page.getByLabel('이메일 주소').fill(user.email);
    await page.getByLabel('비밀번호',{exact:true}).fill('incorrect');
    await page.getByRole('button',{name:'로그인',exact:true}).last().click();
    await page.getByRole('alert').getByText(/이메일이나 비밀번호/).waitFor();
    console.log('PASS invalid credentials');

    await page.getByLabel('비밀번호',{exact:true}).fill('validPassword789!');
    await page.getByRole('button',{name:'로그인',exact:true}).last().click();
    await page.waitForURL('**/account',{timeout:15000});
    await page.getByText(/로그인 및 본인 프로필 읽기 확인 완료/).waitFor();
    console.log('PASS login and own profile API read');

    await page.goto(ORIGIN+'/',{waitUntil:'networkidle'});
    await page.getByText('할 일 보드 보기').click();
    await page.getByText('클라우드에서 온 일정',{exact:true}).first().waitFor();
    console.log('PASS cloud data is pulled into the first device OPFS store');

    await page.getByRole('button',{name:'빠른 일정 추가 (Cmd/Ctrl+K)',exact:true}).click();
    await page.getByRole('tab',{name:'할 일',exact:true}).click();
    await page.getByLabel('할 일 이름').fill('PC에서 만든 동기화 테스트');
    await page.getByRole('button',{name:'할 일 저장'}).click();
    await page.getByText('할 일을 저장했습니다.').waitFor();
    await page.goto(ORIGIN+'/settings',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:/지금 동기화/}).click();
    for(let attempt=0;attempt<100 && !cloud.tasks.some(item=>item.title==='PC에서 만든 동기화 테스트');attempt++) {
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(cloud.tasks.some(item=>item.title==='PC에서 만든 동기화 테스트'),`settings=${await page.locator('body').innerText()} writes=${JSON.stringify(restWrites)}`);
    console.log('PASS first device uploads an offline-first task without duplicates');

    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:/백업 다운로드/}).click();
    const download=await downloadPromise;
    const backupPath=await download.path();
    const backupText=fs.readFileSync(backupPath,'utf8');
    const backup=JSON.parse(backupText);
    assert.equal(backup.format,'daymo-backup');
    assert.match(backup.checksum,/^[0-9a-f]{64}$/);
    assert.ok(backup.data.tasks.some(item=>item.title==='PC에서 만든 동기화 테스트'));
    const chooserPromise=page.waitForEvent('filechooser');
    await page.getByRole('button',{name:/백업 복구/}).click();
    const chooser=await chooserPromise;
    await chooser.setFiles({name:'daymo-backup.json',mimeType:'application/json',buffer:Buffer.from(backupText)});
    await page.getByText(/백업을 복구했습니다/).waitFor({timeout:15000});
    console.log('PASS checksum backup download and transactional restore');

    const phoneContext=await browser.newContext({viewport:{width:390,height:844}});
    const phone=await phoneContext.newPage();
    phone.on('pageerror', e=>errors.push('phone: '+e.message));
    await installRoutes(phone);
    await phone.goto(ORIGIN+'/login',{waitUntil:'networkidle'});
    await phone.getByLabel('이메일 주소').fill(user.email);
    await phone.getByLabel('비밀번호',{exact:true}).fill('validPassword789!');
    await phone.getByRole('button',{name:'로그인',exact:true}).last().click();
    await phone.waitForURL('**/account',{timeout:15000});
    await phone.goto(ORIGIN+'/',{waitUntil:'networkidle'});
    await phone.getByText('할 일 보드 보기').click();
    await phone.getByText('PC에서 만든 동기화 테스트',{exact:true}).first().waitFor({timeout:15000});
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),false);
    await phoneContext.close();
    console.log('PASS second 390px device receives the same task');

    await page.goto(ORIGIN+'/account',{waitUntil:'networkidle'});
    await page.reload({waitUntil:'networkidle'});
    await page.getByText(/로그인 및 본인 프로필 읽기 확인 완료/).waitFor();
    console.log('PASS session remains after reload');

    await page.getByRole('button',{name:'로그아웃'}).click();
    await page.waitForURL('**/login',{timeout:15000});
    console.log('PASS logout');

    await page.getByRole('button',{name:'가입',exact:true}).click();
    await page.getByLabel('이메일 주소').fill(user.email);
    await page.getByLabel('비밀번호',{exact:true}).fill('validPassword789!');
    await page.getByRole('button',{name:'이메일로 가입'}).click();
    await page.getByText(/인증 메일이 도착하면/).waitFor();
    console.log('PASS signup pending confirmation');

    await page.getByRole('button',{name:'비밀번호를 잊으셨나요?'}).click();
    await page.getByRole('button',{name:'재설정 메일 보내기'}).click();
    await page.getByText(/비밀번호 재설정 메일이 발송됩니다/).waitFor();
    console.log('PASS password recovery request');

    assert.deepEqual(errors,[], 'No uncaught page errors');
    console.log('PASS Daymo auth UI mocked integration smoke');
  } finally {
    await browser.close();
  }
}
run().catch(e=>{console.error('FAIL:',e.stack||e); process.exit(1);});
