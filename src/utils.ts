// ms 만큼 딜레이
export async function delay (ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function datesFormatting(month: number) {
  return month <= 9 ? `0${month}` : month.toString();
}

export function getDates(date: Date): [string, string, string, string] {
  return [
    date.getFullYear().toString(),
    datesFormatting(date.getMonth() + 1),
    date.getDate().toString(),
    datesFormatting(date.getHours()),
  ];
}
