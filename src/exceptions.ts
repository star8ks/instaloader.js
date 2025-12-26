/**
 * Base exception for Instaloader.
 * This exception should not be thrown directly.
 */
export class InstaloaderException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'InstaloaderException';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when Instagram API returns a 400 Bad Request.
 */
export class QueryReturnedBadRequestException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'QueryReturnedBadRequestException';
  }
}

/**
 * Thrown when Instagram API returns a 403 Forbidden.
 */
export class QueryReturnedForbiddenException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'QueryReturnedForbiddenException';
  }
}

/**
 * Thrown when the requested profile does not exist.
 */
export class ProfileNotExistsException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'ProfileNotExistsException';
  }
}

/**
 * @deprecated Not raised anymore since version 4.2.2
 */
export class ProfileHasNoPicsException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'ProfileHasNoPicsException';
  }
}

/**
 * Thrown when trying to access a private profile that is not followed.
 */
export class PrivateProfileNotFollowedException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'PrivateProfileNotFollowedException';
  }
}

/**
 * Thrown when login is required to access a resource.
 */
export class LoginRequiredException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'LoginRequiredException';
  }
}

/**
 * Base exception for login-related errors.
 */
export class LoginException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'LoginException';
  }
}

/**
 * Thrown when two-factor authentication is required.
 */
export class TwoFactorAuthRequiredException extends LoginException {
  public readonly twoFactorInfo: TwoFactorInfo;

  constructor(twoFactorInfo: TwoFactorInfo, message?: string) {
    super(message ?? 'Two-factor authentication required');
    this.name = 'TwoFactorAuthRequiredException';
    this.twoFactorInfo = twoFactorInfo;
  }
}

export interface TwoFactorInfo {
  username: string;
  identifier: string;
  obfuscatedPhoneNumber?: string;
  showMessengerCodeOption?: boolean;
  showNewLoginScreen?: boolean;
  showTrustedDeviceOption?: boolean;
  phoneverificationSettings?: PhoneVerificationSettings;
  pendingTrustedNotificationPolling?: boolean;
}

export interface PhoneVerificationSettings {
  maxSmsCount?: number;
  resendSmsDelaySec?: number;
  robocallCountDownTimeSec?: number;
  robocallAfterMaxSms?: boolean;
}

/**
 * Thrown when an invalid argument is passed.
 */
export class InvalidArgumentException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'InvalidArgumentException';
  }
}

/**
 * Thrown when the API returns an unexpected response.
 */
export class BadResponseException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'BadResponseException';
  }
}

/**
 * Thrown when login credentials are invalid.
 */
export class BadCredentialsException extends LoginException {
  constructor(message?: string) {
    super(message);
    this.name = 'BadCredentialsException';
  }
}

/**
 * Thrown when there is a network connection error.
 */
export class ConnectionException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'ConnectionException';
  }
}

/**
 * Thrown when a post has changed since it was loaded.
 * @since 4.2.2
 */
export class PostChangedException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'PostChangedException';
  }
}

/**
 * Thrown when Instagram API returns a 404 Not Found.
 */
export class QueryReturnedNotFoundException extends ConnectionException {
  constructor(message?: string) {
    super(message);
    this.name = 'QueryReturnedNotFoundException';
  }
}

/**
 * Thrown when Instagram API returns a 429 Too Many Requests.
 */
export class TooManyRequestsException extends ConnectionException {
  constructor(message?: string) {
    super(message);
    this.name = 'TooManyRequestsException';
  }
}

/**
 * Thrown when iPhone support is disabled but an iPhone-only feature is requested.
 */
export class IPhoneSupportDisabledException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'IPhoneSupportDisabledException';
  }
}

/**
 * Exception that is not caught in the error handlers inside the download loop
 * and so aborts the download loop.
 *
 * This exception is not a subclass of InstaloaderException.
 *
 * @since 4.7
 */
export class AbortDownloadException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'AbortDownloadException';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the session file is not found.
 */
export class SessionNotFoundException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'SessionNotFoundException';
  }
}

/**
 * Thrown when a checkpoint/challenge is required.
 */
export class CheckpointRequiredException extends ConnectionException {
  public readonly checkpointUrl: string | undefined;

  constructor(message?: string, checkpointUrl?: string) {
    super(message);
    this.name = 'CheckpointRequiredException';
    this.checkpointUrl = checkpointUrl;
  }
}

/**
 * Thrown when the iterator state is invalid or expired.
 */
export class InvalidIteratorException extends InstaloaderException {
  constructor(message?: string) {
    super(message);
    this.name = 'InvalidIteratorException';
  }
}
