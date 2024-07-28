// ms 만큼 딜레이
export async function delay (ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
