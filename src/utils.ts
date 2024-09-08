import { DateBraning } from "./types/date-branding.type";

// ms 만큼 딜레이
export async function delay (ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function datesFormatting(n: number) {
  return n <= 9 ? `0${n}` as DateBraning : n.toString() as DateBraning;
}

/**
 * @Returns [year, month, date, hour, minute]
 */
export function getDates(date: Date): [string, DateBraning, DateBraning, DateBraning, DateBraning] {
  return [
    date.getFullYear().toString(),
    datesFormatting(date.getMonth() + 1),
    datesFormatting(date.getDate()),
    datesFormatting(date.getHours()),
    datesFormatting(date.getMinutes()),
  ];
}
