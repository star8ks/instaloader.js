/**
 * Tests for exceptions.ts
 */

import { describe, it, expect } from 'vitest';
import {
  InstaloaderException,
  LoginException,
  BadCredentialsException,
  ConnectionException,
  TooManyRequestsException,
  QueryReturnedBadRequestException,
  QueryReturnedNotFoundException,
  QueryReturnedForbiddenException,
  ProfileNotExistsException,
  ProfileHasNoPicsException,
  PrivateProfileNotFollowedException,
  LoginRequiredException,
  TwoFactorAuthRequiredException,
  InvalidArgumentException,
  BadResponseException,
  PostChangedException,
  AbortDownloadException,
  CheckpointRequiredException,
  InvalidIteratorException,
  IPhoneSupportDisabledException,
  SessionNotFoundException,
  TwoFactorInfo,
} from '../exceptions';

describe('InstaloaderException', () => {
  it('should be throwable with message', () => {
    const error = new InstaloaderException('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('InstaloaderException');
    expect(error instanceof Error).toBe(true);
  });

  it('should be throwable without message', () => {
    const error = new InstaloaderException();
    expect(error.message).toBe('');
    expect(error.name).toBe('InstaloaderException');
  });
});

describe('LoginException', () => {
  it('should extend InstaloaderException', () => {
    const error = new LoginException('Login failed');
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('LoginException');
  });
});

describe('BadCredentialsException', () => {
  it('should extend LoginException', () => {
    const error = new BadCredentialsException('Wrong password');
    expect(error instanceof LoginException).toBe(true);
    expect(error.name).toBe('BadCredentialsException');
  });
});

describe('ConnectionException', () => {
  it('should extend InstaloaderException', () => {
    const error = new ConnectionException('Connection failed');
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('ConnectionException');
  });
});

describe('TooManyRequestsException', () => {
  it('should extend ConnectionException', () => {
    const error = new TooManyRequestsException('Rate limited');
    expect(error instanceof ConnectionException).toBe(true);
    expect(error.name).toBe('TooManyRequestsException');
  });
});

describe('QueryReturnedBadRequestException', () => {
  it('should extend InstaloaderException', () => {
    const error = new QueryReturnedBadRequestException();
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('QueryReturnedBadRequestException');
  });
});

describe('QueryReturnedNotFoundException', () => {
  it('should extend ConnectionException', () => {
    const error = new QueryReturnedNotFoundException();
    expect(error instanceof ConnectionException).toBe(true);
    expect(error.name).toBe('QueryReturnedNotFoundException');
  });
});

describe('QueryReturnedForbiddenException', () => {
  it('should extend InstaloaderException', () => {
    const error = new QueryReturnedForbiddenException();
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('QueryReturnedForbiddenException');
  });
});

describe('ProfileNotExistsException', () => {
  it('should extend InstaloaderException', () => {
    const error = new ProfileNotExistsException('User not found');
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('ProfileNotExistsException');
  });
});

describe('ProfileHasNoPicsException', () => {
  it('should extend InstaloaderException', () => {
    const error = new ProfileHasNoPicsException('No posts');
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('ProfileHasNoPicsException');
  });
});

describe('PrivateProfileNotFollowedException', () => {
  it('should extend InstaloaderException', () => {
    const error = new PrivateProfileNotFollowedException('Private profile');
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('PrivateProfileNotFollowedException');
  });
});

describe('LoginRequiredException', () => {
  it('should extend InstaloaderException', () => {
    const error = new LoginRequiredException('Login required');
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('LoginRequiredException');
  });
});

describe('TwoFactorAuthRequiredException', () => {
  const sampleTwoFactorInfo: TwoFactorInfo = {
    username: 'testuser',
    identifier: 'test-identifier',
    obfuscatedPhoneNumber: '+1 *** *** **89',
    showMessengerCodeOption: false,
    showNewLoginScreen: true,
    showTrustedDeviceOption: true,
  };

  it('should extend LoginException', () => {
    const error = new TwoFactorAuthRequiredException(sampleTwoFactorInfo);
    expect(error instanceof LoginException).toBe(true);
    expect(error.name).toBe('TwoFactorAuthRequiredException');
  });

  it('should store twoFactorInfo', () => {
    const error = new TwoFactorAuthRequiredException(sampleTwoFactorInfo);
    expect(error.twoFactorInfo).toBe(sampleTwoFactorInfo);
    expect(error.twoFactorInfo.username).toBe('testuser');
    expect(error.twoFactorInfo.identifier).toBe('test-identifier');
  });

  it('should use default message if none provided', () => {
    const error = new TwoFactorAuthRequiredException(sampleTwoFactorInfo);
    expect(error.message).toBe('Two-factor authentication required');
  });

  it('should use custom message if provided', () => {
    const error = new TwoFactorAuthRequiredException(sampleTwoFactorInfo, 'Custom 2FA message');
    expect(error.message).toBe('Custom 2FA message');
  });
});

describe('InvalidArgumentException', () => {
  it('should extend InstaloaderException', () => {
    const error = new InvalidArgumentException('Invalid argument');
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('InvalidArgumentException');
  });
});

describe('BadResponseException', () => {
  it('should extend InstaloaderException', () => {
    const error = new BadResponseException('Bad response');
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('BadResponseException');
  });
});

describe('PostChangedException', () => {
  it('should extend InstaloaderException', () => {
    const error = new PostChangedException('Post changed');
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('PostChangedException');
  });
});

describe('AbortDownloadException', () => {
  it('should extend Error but not InstaloaderException', () => {
    const error = new AbortDownloadException('Aborted');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof InstaloaderException).toBe(false);
    expect(error.name).toBe('AbortDownloadException');
  });
});

describe('IPhoneSupportDisabledException', () => {
  it('should extend InstaloaderException', () => {
    const error = new IPhoneSupportDisabledException('iPhone support disabled');
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('IPhoneSupportDisabledException');
  });
});

describe('SessionNotFoundException', () => {
  it('should extend InstaloaderException', () => {
    const error = new SessionNotFoundException('Session not found');
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('SessionNotFoundException');
  });
});

describe('CheckpointRequiredException', () => {
  it('should extend ConnectionException', () => {
    const error = new CheckpointRequiredException('Checkpoint required');
    expect(error instanceof ConnectionException).toBe(true);
    expect(error.name).toBe('CheckpointRequiredException');
  });

  it('should store checkpointUrl', () => {
    const error = new CheckpointRequiredException('Checkpoint', 'https://example.com/checkpoint');
    expect(error.checkpointUrl).toBe('https://example.com/checkpoint');
  });

  it('should work without checkpointUrl', () => {
    const error = new CheckpointRequiredException('Checkpoint');
    expect(error.checkpointUrl).toBeUndefined();
  });
});

describe('InvalidIteratorException', () => {
  it('should extend InstaloaderException', () => {
    const error = new InvalidIteratorException('Invalid iterator');
    expect(error instanceof InstaloaderException).toBe(true);
    expect(error.name).toBe('InvalidIteratorException');
  });
});

describe('Exception inheritance', () => {
  it('should allow catching all Instaloader exceptions with InstaloaderException', () => {
    const sampleTwoFactorInfo: TwoFactorInfo = {
      username: 'testuser',
      identifier: 'test-identifier',
    };

    const exceptions = [
      new LoginException(),
      new BadCredentialsException(),
      new ConnectionException(),
      new TooManyRequestsException(),
      new ProfileNotExistsException(),
      new LoginRequiredException(),
      new TwoFactorAuthRequiredException(sampleTwoFactorInfo),
      new InvalidArgumentException(),
      new PostChangedException(),
      new CheckpointRequiredException(),
      new InvalidIteratorException(),
      new IPhoneSupportDisabledException(),
      new SessionNotFoundException(),
      new BadResponseException(),
      new QueryReturnedBadRequestException(),
      new QueryReturnedForbiddenException(),
      new QueryReturnedNotFoundException(),
      new ProfileHasNoPicsException(),
      new PrivateProfileNotFollowedException(),
    ];

    for (const exception of exceptions) {
      expect(exception instanceof InstaloaderException).toBe(true);
    }
  });

  it('AbortDownloadException should not be caught by InstaloaderException handler', () => {
    const error = new AbortDownloadException('Aborted');
    expect(error instanceof InstaloaderException).toBe(false);
  });
});
