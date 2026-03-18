import { jest } from '@jest/globals';
import { logger } from '../logger.js';

describe('logger', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('writes JSON line to stderr on info', () => {
    logger.info('test message', { key: 'value' });
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('info');
    expect(output.message).toBe('test message');
    expect(output.key).toBe('value');
  });

  it('writes JSON line to stderr on error', () => {
    logger.error('something failed', { code: 'TEST_ERROR' });
    const output = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('error');
    expect(output.message).toBe('something failed');
  });

  it('includes timestamp in every log line', () => {
    logger.info('check timestamp');
    const output = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(output.timestamp).toBeDefined();
    expect(typeof output.timestamp).toBe('string');
  });
});
