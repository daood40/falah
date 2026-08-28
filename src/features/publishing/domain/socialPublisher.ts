/**
 * SocialPublisher — pluggable publishing layer.
 *
 * Each platform is an adapter implementing `PlatformPublisher`. Adding a platform
 * never touches the core system. FALAH NEVER pretends publishing succeeded:
 * an adapter without configured OAuth credentials reports `configured: false`
 * and `publish` throws AppError('not_configured') with setup instructions
 * (see docs/DEPLOYMENT.md — every official API needs app credentials that only
 * the operator can create).
 */
import { AppError } from '@core/errors/errors';
import type { ContentProject, Platform } from '@core/models/content';
import { kvGet, kvSet } from '@core/db/localdb';

export interface PublishPayload {
  project: ContentProject;
  /** Exported media blob (PNG/WebM) produced through the Source Lock gate. */
  media: Blob;
  caption: string;
  /**
   * Idempotency key from the scheduled post: adapters pass it to their edge
   * function so a retried attempt after a timeout can never publish twice.
   */
  idempotencyKey?: string;
}

export interface PublishResult {
  platform: Platform;
  remoteId: string;
  url: string | null;
}

export interface PlatformConnection {
  platform: Platform;
  accountName: string;
  connectedAt: string;
}

export interface PlatformPublisher {
  readonly platform: Platform;
  readonly displayName: string;
  /** True when operator credentials + user OAuth are in place. */
  isConfigured(): Promise<boolean>;
  getConnection(): Promise<PlatformConnection | null>;
  /** Starts the OAuth flow (redirect); throws not_configured without operator credentials. */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(payload: PublishPayload): Promise<PublishResult>;
}

const CONNECTION_KEY = (p: Platform) => `social.connection.${p}`;

/**
 * Base adapter for the official OAuth-based APIs. The OAuth handshake and the
 * upload call run through Supabase Edge Functions so app secrets stay
 * server-side (see supabase/functions and docs/API.md). Until those functions
 * are deployed with credentials, the adapter honestly reports not-configured.
 */
abstract class OAuthPublisher implements PlatformPublisher {
  abstract readonly platform: Platform;
  abstract readonly displayName: string;
  /** Edge function route implementing this platform's OAuth + publish. */
  protected abstract readonly functionRoute: string;

  async isConfigured(): Promise<boolean> {
    return (await this.getConnection()) !== null;
  }

  async getConnection(): Promise<PlatformConnection | null> {
    return (await kvGet<PlatformConnection>(CONNECTION_KEY(this.platform))) ?? null;
  }

  async connect(): Promise<void> {
    throw new AppError(
      'not_configured',
      `${this.displayName} OAuth requires operator credentials for the '${this.functionRoute}' edge function — see docs/DEPLOYMENT.md`,
    );
  }

  async disconnect(): Promise<void> {
    await kvSet(CONNECTION_KEY(this.platform), null);
  }

  async publish(_payload: PublishPayload): Promise<PublishResult> {
    const connection = await this.getConnection();
    if (!connection) {
      throw new AppError(
        'not_configured',
        `${this.displayName} is not connected — complete OAuth setup first (docs/DEPLOYMENT.md)`,
      );
    }
    throw new AppError(
      'not_configured',
      `${this.displayName} publishing requires the '${this.functionRoute}' edge function to be deployed with API credentials`,
    );
  }
}

class InstagramPublisher extends OAuthPublisher {
  readonly platform = 'instagram' as const;
  readonly displayName = 'Instagram';
  protected readonly functionRoute = 'publish-meta';
}

class FacebookPublisher extends OAuthPublisher {
  readonly platform = 'facebook' as const;
  readonly displayName = 'Facebook';
  protected readonly functionRoute = 'publish-meta';
}

class TikTokPublisher extends OAuthPublisher {
  readonly platform = 'tiktok' as const;
  readonly displayName = 'TikTok';
  protected readonly functionRoute = 'publish-tiktok';
}

class YouTubePublisher extends OAuthPublisher {
  readonly platform = 'youtube' as const;
  readonly displayName = 'YouTube';
  protected readonly functionRoute = 'publish-youtube';
}

class XPublisher extends OAuthPublisher {
  readonly platform = 'x' as const;
  readonly displayName = 'X';
  protected readonly functionRoute = 'publish-x';
}

class TelegramPublisher extends OAuthPublisher {
  readonly platform = 'telegram' as const;
  readonly displayName = 'Telegram';
  protected readonly functionRoute = 'publish-telegram';
}

const registry = new Map<Platform, PlatformPublisher>();

export function registerPublisher(publisher: PlatformPublisher): void {
  registry.set(publisher.platform, publisher);
}

[
  new InstagramPublisher(),
  new FacebookPublisher(),
  new TikTokPublisher(),
  new YouTubePublisher(),
  new XPublisher(),
  new TelegramPublisher(),
].forEach(registerPublisher);

export function publisherFor(platform: Platform): PlatformPublisher {
  const publisher = registry.get(platform);
  if (!publisher) {
    throw new AppError('validation', `Unknown platform: ${platform}`);
  }
  return publisher;
}

export function listPublishers(): PlatformPublisher[] {
  return [...registry.values()];
}
