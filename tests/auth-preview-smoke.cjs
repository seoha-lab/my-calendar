const assert = require('node:assert/strict');
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
  const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] });
  const page = await browser.newPage({viewport:{width:1200,height:860}});
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));

  await page.route('https://qglwymsqskagoobpvcna.supabase.co/**', async(route)=>{
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
    if(url.pathname==='/auth/v1/token' && url.searchParams.get('grant_type')==='refresh_token') {
      return json({access_token:token,token_type:'bearer',expires_in:3600,refresh_token:'daymo-test-refresh-token',user});
    }
    return json({message:'No mocked API route: '+url.pathname},404);
  });

  try {
    await page.goto(ORIGIN+'/',{waitUntil:'networkidle'});
    assert.match(await page.locator('body').innerText(),/Daymo 계정 로그인 테스트/);
    assert.equal(await page.getByText('할 일 보드 보기').count(),0,'No legacy SQLite task board in auth Preview');
    console.log('PASS preview gate protects legacy local data');

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
