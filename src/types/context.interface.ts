export interface Context {
  phoneNumber: [number, number];
  password: string;
  departStation: string;
  arriveStation: string;
  departDate: `${number}-${number}-${number} ${number}:${number}:${number}`;
}
