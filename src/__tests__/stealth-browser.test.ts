import { jest, describe, it, expect } from '@jest/globals';

const mockUse = jest.fn();
const mockExtraInstance = { use: mockUse, launch: jest.fn(), connect: jest.fn() };
const mockAddExtra = jest.fn(() => mockExtraInstance);
const stealthPluginMarker = { name: 'stealth' };
const mockStealthPlugin = jest.fn(() => stealthPluginMarker);

jest.unstable_mockModule('puppeteer-extra', () => ({
  addExtra: mockAddExtra
}));

jest.unstable_mockModule('puppeteer-extra-plugin-stealth', () => ({
  default: mockStealthPlugin
}));

jest.unstable_mockModule('puppeteer-core', () => ({
  default: { markerForRealPuppeteerCore: true }
}));

const { stealthPuppeteer } = await import('../stealth-browser.js');

describe('stealthPuppeteer', () => {
  it('wraps puppeteer-core with addExtra', () => {
    expect(mockAddExtra).toHaveBeenCalledWith({ markerForRealPuppeteerCore: true });
  });

  it('registers the stealth plugin exactly once', () => {
    expect(mockStealthPlugin).toHaveBeenCalledTimes(1);
    expect(mockUse).toHaveBeenCalledWith(stealthPluginMarker);
  });

  it('exposes launch and connect from the wrapped instance', () => {
    expect(stealthPuppeteer.launch).toBe(mockExtraInstance.launch);
    expect(stealthPuppeteer.connect).toBe(mockExtraInstance.connect);
  });
});
