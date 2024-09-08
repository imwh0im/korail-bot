import { Page } from "puppeteer"
import { Brand } from "./branding.type";

export type LoginedPage = Brand<'logined', Page>;

export type TicketPage = Brand<'ticket', Page>;
