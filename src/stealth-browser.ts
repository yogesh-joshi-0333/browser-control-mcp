import { addExtra } from 'puppeteer-extra';
import type { VanillaPuppeteer } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerCore from 'puppeteer-core';

/**
 * puppeteer-core wrapped with puppeteer-extra + the stealth plugin, so both
 * createSession() (launch) and createConnectSession() (connect) get the same
 * bot-detection evasions applied on every page they create.
 *
 * puppeteer-extra's types target the full `puppeteer` package (which bundles
 * a browser downloader); puppeteer-core intentionally omits that, so the two
 * shapes don't line up exactly even though launch()/connect() are identical.
 */
export const stealthPuppeteer = addExtra(puppeteerCore as unknown as VanillaPuppeteer);
stealthPuppeteer.use(StealthPlugin());
