import puppeteer from "puppeteer";
import readline from "readline";
import { brandingStationName, korailLogin, ticketSearch } from "./crawler";
import dayjs from "dayjs";

// readline BASIC
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 코레일 로그인 URL
const korailLoginUrl = 'https://www.letskorail.com/korail/com/login.do';



async function run(departStation: string, arriveStation: string, departDate: string, departTime: string, secondPhoneNumber: number, thirdPhoneNumber: number, password: string) {
  // PUPPETEER BASIC
  const browser = await puppeteer.launch();
  // 코레일 로그인 페이지
  const loginedPage = await korailLogin(browser, [secondPhoneNumber, thirdPhoneNumber], password);
  // onClick 이벤트와 동시에 알럿 뜨는 부분이 있어서 무시하기 위함
  loginedPage.on('dialog', async dialog => {
    await dialog.accept();
	});

  

  // 잔여 티켓 나올때까지 계속 조회 후 잔여 티켓 발견시 즉시 예약
  // await ticketCheckLoop(loginedPage);

  // PUPPETEER BASIC
  await loginedPage.close();
  await browser.close();
}

// let departStation = '';
// let arriveStation = '';
// let departDate = '';
// let departTime = '';
// let secondPhoneNumber = '';
// let thirdPhoneNumber = '';
// let password = '';

async function test() {
  console.log('run')
  const browser = await puppeteer.launch();
  const page = await korailLogin(browser, [7604, 9332], 'aram9332!');
  page.on('dialog', async dialog => {
    await dialog.accept();
	});
  const departStation = await brandingStationName(browser, '남춘천');
  const arriveStation = await brandingStationName(browser, '용산');
  await ticketSearch(
    page,
    departStation,
    arriveStation,
    dayjs('2024-09-13 07:26:00').toDate()
  );
}

test().then(() => console.log('done'));


// rl.question('출발 역을 입력해주세요. (용산역 => 용산) ', (answer) => {
//   departStation = answer;
  
//   rl.question('도착 역을 입력해주세요. (서울역 => 서울) ', (answer) => {
//     arriveStation = answer;

//     rl.question('출발 날짜를 입력해주세요. (YYYY.MM.DD) ', (answer) => {
//       departDate = answer;

//       rl.question('출발 시간을 입력해주세요. (ex. 오후 1시 출발인 경우 = 13)', (answer) => {
//         departTime = answer;

//         rl.question('전화번호 가운데 4자리를 입력해주세요. ', (answer) => {
//           secondPhoneNumber = answer;
      
//           rl.question('전화번호 끝 4자리를 입력해주세요. ', (answer) => {
//             thirdPhoneNumber = answer;
      
//             rl.question('비밀번호를 입력해주세요. ', (answer) => {
//               password = answer;
      
//               run(departStation, arriveStation, departDate, departTime, secondPhoneNumber, thirdPhoneNumber, password).then(() => rl.close());
//             })
//           });
//         });
//       });
//     });
//   });
// });
