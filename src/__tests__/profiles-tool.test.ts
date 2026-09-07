import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../profiles.js', () => ({
  listProfiles: jest.fn(),
  deleteProfile: jest.fn(),
  isValidProfileName: jest.fn()
}));

const { profilesTool } = await import('../tools/profiles.js');
const profiles = await import('../profiles.js');

const mockListProfiles = profiles.listProfiles as jest.MockedFunction<typeof profiles.listProfiles>;
const mockDeleteProfile = profiles.deleteProfile as jest.MockedFunction<typeof profiles.deleteProfile>;
const mockIsValidProfileName = profiles.isValidProfileName as jest.MockedFunction<typeof profiles.isValidProfileName>;

describe('browser_profiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsValidProfileName.mockReturnValue(true);
  });

  it('action "list" returns saved profile names', async () => {
    mockListProfiles.mockResolvedValue(['work', 'personal']);

    const result = await profilesTool.handler({ action: 'list' });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.profiles).toEqual(['work', 'personal']);
  });

  it('action "delete" removes the named profile', async () => {
    const result = await profilesTool.handler({ action: 'delete', name: 'work' });

    expect(result.isError).toBeFalsy();
    expect(mockDeleteProfile).toHaveBeenCalledWith('work');
  });

  it('action "delete" requires a name', async () => {
    const result = await profilesTool.handler({ action: 'delete' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_NAME');
  });

  it('action "delete" rejects an invalid profile name without touching disk', async () => {
    mockIsValidProfileName.mockReturnValue(false);

    const result = await profilesTool.handler({ action: 'delete', name: '../etc' });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.code).toBe('INVALID_PROFILE_NAME');
    expect(mockDeleteProfile).not.toHaveBeenCalled();
  });

  it('returns an error for an unknown action', async () => {
    const result = await profilesTool.handler({ action: 'bogus' });

    expect(result.isError).toBe(true);
  });
});
