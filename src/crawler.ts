import { Browser, Page } from "puppeteer";
import { KorailStaionName, LoginedPage, StationName } from "./types";
import { delay } from "./utils";
import dayjs from "dayjs";
import hangul from "hangul-js";

// 코레일 역별 인덱스
const hidKorInx = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];

// 여러 곳에서 참조하는 예약 버튼 selector
const reservationButtonSelector = '#tableResult > tbody > tr:nth-child(1) > td:nth-child(6) > a:nth-child(1)';

// 예약 완료 후 정보를 조회하는 테이블
const reservationConfirmTable = '#pnrInfo > div > table:nth-child(1) > tbody > tr >';

// 코레일 로그인 URL
const korailLoginUrl = 'https://www.letskorail.com/korail/com/login.do';

/**
 * 역 이름 크롤링
 */
async function getStationList(browser: Browser, str: string) {
  // 가~하 순으로 인덱스 추출
  const regionIndex = hidKorInx.findIndex((ele) => ele === str);
  if (regionIndex === -1) {
    throw new Error('Not found station');
  }

  const page = await browser.newPage();

  // 코레일 역 목록 페이지 접근
  await page.goto(`https://www.letskorail.com/ebizprd/EbizPrdTicketPr11100/searchTnCode.do?hidKorInx=${regionIndex}`, {
    waitUntil: 'networkidle0',
  });

  // 코레일 역 이름 배열로 만듬
  const data = await page.evaluate(() => {
    const tds: KorailStaionName[] = Array.from(document.querySelectorAll('body div div.cont div table tr td a'));
    return tds.map(td => td.innerText.trim())
  });

  await page.close();

  return data;
}

/**
 * 역 이름 브랜딩
 */
export async function brandingStationName(browser: Browser, stationName: string) {
  const firstWord = hangul.disassemble(stationName)[0];
  const regionIndexEle = hangul.assemble([firstWord, 'ㅏ']);

  const stationList = await getStationList(browser, regionIndexEle);
  const hasStation = stationList.includes(stationName);
  if (!hasStation) {
    throw new Error('invalid station name');
  }

  return stationName as StationName;
}

/**
 * 핸드폰 번호 기반 코레일 로그인
 */
export async function korailLogin(browser: Browser, phoneNums: [number, number], password: string) {
  const page = await browser.newPage();

  // 코레일 로그인 페이지 접근
  await page.goto(korailLoginUrl, {
    waitUntil: 'networkidle0'
  });

  // 전화번호로 로그인하기
  await page.click('#radInputFlg2');

  // 로그인 정보 입력
  await page.$eval('input[name=txtCpNo2]', (el, n) => el.value = n, phoneNums[0].toString());
  await page.$eval('input[name=txtCpNo3]', (el, n) => el.value = n, phoneNums[1].toString());
  await page.$eval('input[name=txtPwd1]', (el, n) => el.value = n, password);
  await page.click('#loginDisplay2 > ul > li.btn_login > a');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  return page as LoginedPage;
}

/**
 * 승차권 조회
 */
export async function ticketSearch(page: LoginedPage, departStation: StationName, arriveStation: StationName, departDate: Date) {
  // 승차권 조회 페이지 이동
  await Promise.all([
    page.click('#header > div.lnb > div.lnb_m01 > h3 > a'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
  ]);

  const year = departDate.getFullYear();
  const month = departDate.getMonth();
  const day = departDate.getDate();

  // 승차권 조회 조건
  await page.$eval('input[name=txtGoStart]', (el, n) => el.value = n, departStation) // 출발역
  await page.$eval('input[name=txtGoEnd]', (el, n) => el.value = n, arriveStation)  // 도착역
  await page.select('select[name=selGoYear]', year.toString()); // 출발 날짜 (년)
  await page.select('select[name=selGoMonth]', month.toString());  // 출발 날짜 (월)
  await page.select('select[name=selGoDay]', day.toString());  // 출발 날짜 (일))

  await page.click('#center > form > div > p > a');

  await page.screenshot({ path: `./logs/test.png`, fullPage: true }); // Logging
}

/**
 * 티켓 조회 재귀 함수
 */
async function ticketCheckLoop(page: Page) {
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
      return !!element?.textContent;
    });
    // 티켓 조회와 예약버튼 누르는 사이에 이미 예약이 되었을 경우 이전 페이지로 돌아가고 다시 Loop
    if (alreadyReservation) {
      await page.screenshot({ path: `./logs/already-reservation-${now.format('HH:mm:ss')}.png`, fullPage: true }); // Logging
      console.log(`이미 예약됨 ${now.format('HH:mm:ss')}`);
      await page.click('#contents > div.content > div.cont_info > div > p.btn_c > a');
      return ticketCheckLoop(page);
    }
    await page.screenshot({ path: `./logs/success-${now.format('HH:mm:ss')}.png`, fullPage: true }); // Logging
    const date = await page.$eval(`${reservationConfirmTable} td:nth-child(1)`, (data) => data.textContent) || '';
    const departTime = await page.$eval(`${reservationConfirmTable} td:nth-child(5)`, (data) => data.textContent) || '';
    const depart = await page.$eval(`${reservationConfirmTable} td.bdl_on`, (data) => data.textContent) || '';
    const arriveTime = await page.$eval(`${reservationConfirmTable} td:nth-child(7)`, (data) => data.textContent) || '';
    const arrive = await page.$eval(`${reservationConfirmTable} td:nth-child(6)`, (data) => data.textContent) || '';
    console.log(`${date.trim()} 날에 ${depart.trim()} 에서 ${departTime.trim()} 에 출발하여, ${arrive.trim()} 에 ${arriveTime.trim()} 도착 예정인 표가 예약되었습니다. 이 과정은 *예약*만 된것이므로 웹 페이지 또는 앱 내에서 "예약 승차권 조회" 를 통해 결제를 하여 예약을 확정하세요.`)
  } else {
    // 티켓이 없다면 다시 함수 재귀
    return ticketCheckLoop(page);
  }
}
