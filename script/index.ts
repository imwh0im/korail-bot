import puppeteer from "puppeteer";
import dayjs from "dayjs";

import { brandingStationName, korailLogin, reservationTicket, ticketSearch } from "../src/crawler";
import { Context } from "../src/types/context.interface";

/**
 * Context 에 기입후 `npm run start`
 */
const context: Context = {
  phoneNumber: [1111, 1111], // [중간 4자리, 끝 4자리]
  password: 'password', // 코레일 패스워드
  departStation: '남춘천', // 출발역
  arriveStation: '용산',  // 도착역
  departDate: '2024-09-08 13:42:00',  // 출발 시간 (YYYY-mm-dd HH:mm:ss)
}


export async function run(context: Context) {
  const browser = await puppeteer.launch();
  const page = await korailLogin(browser, context.phoneNumber, context.password);
  page.on('dialog', async dialog => {
    await dialog.accept();
	});
  const departStation = await brandingStationName(browser, context.departStation);
  const arriveStation = await brandingStationName(browser, context.arriveStation);
  const departDate = dayjs(context.departDate);

  const [ticketPage, ticketIndex] = await ticketSearch(
    page,
    departStation,
    arriveStation,
    departDate.toDate()
  );

  await reservationTicket(ticketPage, ticketIndex);

  // PUPPETEER BASIC
  await page.close();
  await browser.close();
}

run(context).then(() => {
  console.log('done');
  process.exit(0);
});

