import { Browser, Page } from "puppeteer";
import { KorailStaionName, LoginedPage, StationName, TicketPage } from "./types";
import { delay, getDates } from "./utils";
import dayjs from "dayjs";
import hangul from "hangul-js";
import { DateBraning } from "./types/date-branding.type";

// 코레일 역별 인덱스
const hidKorInx = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];

// 코레일 로그인 URL
const korailLoginUrl = 'https://www.letskorail.com/korail/com/login.do';

/**
 * 역 이름 크롤링
 */
async function getStationList(browser: Browser, str: string) {
  // 가~하 순으로 인덱스 추출
  const regionIndex = hidKorInx.findIndex((ele) => ele === str);
  if (regionIndex === -1) {
    throw new Error(`Not found station: ${str}`);
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
 * 티켓의 테이블 인덱스
 */
async function getTicketIndex(
  page: TicketPage, departStation: StationName, hour: DateBraning, minute: DateBraning
): Promise<number> {
  // 테이블 인덱스 고르기
  const ticketList = await page.evaluate(() => {
    const tableBody = document.querySelectorAll('#tableResult > tbody > tr > td:nth-child(3)');
    return Array.from(tableBody).map(element => element.textContent?.trim())
  });
  const ticketName = `${departStation}${hour}:${minute}`;
  let ticketIndex = ticketList.findIndex(ticket => ticket === ticketName);

  if(ticketIndex === -1) {
    throw new Error(`cannot found ticket ${ticketName}`);
  }

  if (ticketIndex === 0) {
    ticketIndex = 1;
  } else {
    ticketIndex = ticketIndex * 2 + 1;
  }
  return ticketIndex;
}

/**
 * 승차권 조회
 * @retuns [TicketPage, TicketIndex]
 */
export async function ticketSearch(
  page: LoginedPage,
  departStation: StationName,
  arriveStation: StationName,
  departDate: Date
): Promise<[TicketPage, number]> {
  // 승차권 조회 페이지 이동
  await Promise.all([
    page.click('#header > div.lnb > div.lnb_m01 > h3 > a'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  ]);

  const [year, month, day, hour, minute] = getDates(departDate);

  // 승차권 조회 조건
  await page.$eval('input[name=txtGoStart]', (el, n) => el.value = n, departStation) // 출발역
  await page.$eval('input[name=txtGoEnd]', (el, n) => el.value = n, arriveStation)  // 도착역
  await page.select('select[name=selGoYear]', year); // 출발 날짜 (년)
  await page.select('select[name=selGoMonth]', month);  // 출발 날짜 (월)
  await page.select('select[name=selGoDay]', day);  // 출발 날짜 (일))
  await page.select('select[name=selGoHour]', hour); // 출발 시간 (시간)

  await page.click('#center > form > div > p > a');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  await page.screenshot({ path: `./logs/ticket-search.png`, fullPage: true }); // Logging

  const ticketPage = (page as Page) as TicketPage;
  const ticketIndex = await getTicketIndex(ticketPage, departStation, hour, minute);

  return [(page as Page) as TicketPage, ticketIndex];
}

/**
 * 티켓 예약
 */
export async function reservationTicket(page: TicketPage, ticketIndex: number): Promise<void> {
  console.log(`${dayjs().format('HH:mm:ss')} 티켓을 탐색합니다.`);
  const reservationButtonSelector = `#tableResult > tbody > tr:nth-child(${ticketIndex}) > td:nth-child(6) > a:nth-child(1)`
  const hasTicket = await page.$(reservationButtonSelector);
  // 티켓이 있을때
  if (!!hasTicket) {
    await page.screenshot({ path: `./logs/has-ticket.png`, fullPage: true }); // Logging
    await page.click(reservationButtonSelector);
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    // 예약 클릭했을떄 이미 예약 되었는지 확인
    const alreadyReservation = await page.evaluate(() => {
      const element = document.querySelector('#contents > div.content > div.cont_info > div > span');
      return !!element?.textContent;
    });
    // 조회와 예약 사이에 이미 선점된 경우
    if (alreadyReservation) {
      await page.click('#contents > div.content > div.cont_info > div > p.btn_c > a');
    } else {
      return;
    }
  }
  // 최소한의 동업자 정신 1.5초를 기다린다.
  await delay(1500)
  // 티켓이 없으면 재귀
  return reservationTicket(page, ticketIndex);
}
