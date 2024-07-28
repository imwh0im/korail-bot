import { Page } from "puppeteer"

type Brand<Key extends string, value> = value & { __brand: Key }

export type LoginedPage = Brand<'logined', Page>;
