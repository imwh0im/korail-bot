const puppeteer = require('puppeteer');
const readline = require('readline');
const dayjs = require('dayjs');

// readline BASIC
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


// 코레일 로그인 URL
const korailLoginUrl = 'https://www.letskorail.com/korail/com/login.do';

// 여러 곳에서 참조하는 예약 버튼 selector
const reservationButtonSelector = '#tableResult > tbody > tr:nth-child(1) > td:nth-child(6) > a:nth-child(1)';

// 예약 완료 후 정보를 조회하는 테이블
const reservationConfirmTable = '#pnrInfo > div > table:nth-child(1) > tbody > tr >'

// ms 만큼 딜레이
async function delay (ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}  

// 티켓 조회 재귀함수
async function ticketCheckLoop(page) {
  // 최소한의 동업자 정신 3초를 기다린다.
  await delay(3000)
  const now = dayjs();
  console.log(`${now.format('HH:mm:ss')} 티켓을 탐색합니다.`)
  // 조건에 맞는 열차 조회
  try {
    // 처음 이후에는 이 셀렉터로 가야함
    await page.click('#center > div.ticket_box > p > a')
  } catch (err) {
    // 처음 조회할때는 이 셀렉터로 가야함
    await page.click('#center > form > div > p > a');
  }
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  // 티켓 있는지 체크
  // 셀렉터 존재 여부로 티켓이 있는지 없는지 확인
  const hasTicket = await page.$(reservationButtonSelector);
  // 티켓 있으면 예약 진행 후 안내 하고 프로세스 종료
  if (!!hasTicket) {
    await page.screenshot({ path: `./logs/has-ticket-${now.format('HH:mm:ss')}.png`, fullPage: true }); // Logging
    await page.click(reservationButtonSelector)
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    // 예약 클릭했을떄 이미 예약 되었는지 확인
    const alreadyReservation = await page.evaluate(() => {
      const element = document.querySelector('#contents > div.content > div.cont_info > div > span');
      return !!element.textContent;
    });
    // 티켓 조회와 예약버튼 누르는 사이에 이미 예약이 되었을 경우 이전 페이지로 돌아가고 다시 Loop
    if (alreadyReservation) {
      await page.screenshot({ path: `./logs/already-reservation-${now.format('HH:mm:ss')}.png`, fullPage: true }); // Logging
      console.log(`이미 예약됨 ${now.format('HH:mm:ss')}`);
      await page.click('#contents > div.content > div.cont_info > div > p.btn_c > a');
      return ticketCheckLoop(page);
    }
    await page.screenshot({ path: `./logs/success-${now.format('HH:mm:ss')}.png`, fullPage: true }); // Logging
    const date = await page.$eval(`${reservationConfirmTable} td:nth-child(1)`, (data) => data.textContent);
    const departTime = await page.$eval(`${reservationConfirmTable} td:nth-child(5)`, (data) => data.textContent);
    const depart = await page.$eval(`${reservationConfirmTable} td.bdl_on`, (data) => data.textContent);
    const arriveTime = await page.$eval(`${reservationConfirmTable} td:nth-child(7)`, (data) => data.textContent);
    const arrive = await page.$eval(`${reservationConfirmTable} td:nth-child(6)`, (data) => data.textContent);
    console.log(`${date.trim()} 날에 ${depart.trim()} 에서 ${departTime.trim()} 에 출발하여, ${arrive.trim()} 에 ${arriveTime.trim()} 도착 예정인 표가 예약되었습니다. 이 과정은 *예약*만 된것이므로 웹 페이지 또는 앱 내에서 "예약 승차권 조회" 를 통해 결제를 하여 예약을 확정하세요.`)
  } else {
    // 티켓이 없다면 다시 함수 재귀
    return ticketCheckLoop(page);
  }
}

async function run(departStation, arriveStation, departDate, departTime, secondPhoneNumber, thirdPhoneNumber, password) {
  console.log('start');
  // PUPPETEER BASIC
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // onClick 이벤트와 동시에 알럿 뜨는 부분이 있어서 무시하기 위함
  page.on('dialog', async dialog => {
    await dialog.accept();
	});

  // 코레일 로그인 페이지 접근
  await page.goto(korailLoginUrl, {
    waitUntil: 'networkidle0'
  });

  // 전화번호로 로그인하기
  await page.click('#radInputFlg2');

  // 로그인 정보 입력
  await page.$eval('input[name=txtCpNo2]', (el, n) => el.value = n, secondPhoneNumber);
  await page.$eval('input[name=txtCpNo3]', (el, n) => el.value = n, thirdPhoneNumber);
  await page.$eval('input[name=txtPwd1]', (el, n) => el.value = n, password);
  await page.click('#loginDisplay2 > ul > li.btn_login > a');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  // 승차권 조회 페이지 이동
  await Promise.all([
    page.click('#header > div.lnb > div.lnb_m01 > h3 > a'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
  ]);

  // 날짜 추출
  const [y, m ,d] = departDate.split('.');

  // 승차권 조회 조건
  await page.$eval('input[name=txtGoStart]', (el, n) => el.value = n, departStation) // 출발역
  await page.$eval('input[name=txtGoEnd]', (el, n) => el.value = n, arriveStation)  // 도착역
  await page.select('select[name=selGoYear]', y); // 출발 날짜 (년)
  await page.select('select[name=selGoMonth]', m);  // 출발 날짜 (월)
  await page.select('select[name=selGoDay]', d);  // 출발 날짜 (일))
  await page.select('select[name=selGoHour]', departTime) // 출발 시간

  // 잔여 티켓 나올때까지 계속 조회 후 잔여 티켓 발견시 즉시 예약
  await ticketCheckLoop(page);

  // PUPPETEER BASIC
  await page.close();
  await browser.close();
}

let departStation = '';
let arriveStation = '';
let departDate = '';
let departTime = '';
let secondPhoneNumber = '';
let thirdPhoneNumber = '';
let password = '';


rl.question('출발 역을 입력해주세요. (용산역 => 용산) ', (answer) => {
  departStation = answer;
  
  rl.question('도착 역을 입력해주세요. (서울역 => 서울) ', (answer) => {
    arriveStation = answer;

    rl.question('출발 날짜를 입력해주세요. (YYYY.MM.DD) ', (answer) => {
      departDate = answer;

      rl.question('출발 시간을 입력해주세요. (ex. 오후 1시 출발인 경우 = 13)', (answer) => {
        departTime = answer;

        rl.question('전화번호 가운데 4자리를 입력해주세요. ', (answer) => {
          secondPhoneNumber = answer;
      
          rl.question('전화번호 끝 4자리를 입력해주세요. ', (answer) => {
            thirdPhoneNumber = answer;
      
            rl.question('비밀번호를 입력해주세요. ', (answer) => {
              password = answer;
      
              run(departStation, arriveStation, departDate, departTime, secondPhoneNumber, thirdPhoneNumber, password).then(() => rl.close());
            })
          });
        });
      });
    });
  });
});
