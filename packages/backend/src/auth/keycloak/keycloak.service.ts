import { Injectable } from '@nestjs/common';

export interface KeycloakConfig {
  realm: string;
  clientId: string;
  clientSecret: string;
  authServerUrl: string;
  callbackUrl: string;
}

@Injectable()
export class KeycloakService {
  private config: KeycloakConfig;
  private accessTokens: Map<string, { token: string; expiresAt: number }> = new Map();

  constructor() {
    this.config = {
      realm: process.env.KEYCLOAK_REALM || 'amdox',
      clientId: process.env.KEYCLOAK_CLIENT_ID || 'amdox-app',
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
      authServerUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
      callbackUrl: process.env.KEYCLOAK_CALLBACK_URL || 'http://localhost:3000/api/auth/callback',
    };
  }

  getLoginUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.callbackUrl,
      scope: 'openid profile email',
      state,
    });
    return `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/auth?${params}`;
  }

  async getToken(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    id_token: string;
    expires_in: number;
  }> {
    const response = await fetch(
      `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.callbackUrl,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Keycloak token exchange failed: ${response.statusText}`);
    }

    return response.json() as Promise<{
      access_token: string;
      refresh_token: string;
      id_token: string;
      expires_in: number;
    }>;
  }

  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const response = await fetch(
      `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: refreshToken,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Keycloak refresh failed: ${response.statusText}`);
    }

    return response.json() as Promise<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>;
  }

  async getUserInfo(accessToken: string): Promise<{
    sub: string;
    email: string;
    name: string;
    given_name?: string;
    family_name?: string;
  }> {
    const response = await fetch(
      `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/userinfo`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Keycloak userinfo failed: ${response.statusText}`);
    }

    return response.json() as Promise<{
      sub: string;
      email: string;
      name: string;
      given_name?: string;
      family_name?: string;
    }>;
  }

  async logout(refreshToken: string): Promise<void> {
    await fetch(
      `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/logout`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: refreshToken,
        }),
      }
    );
  }

  // SAML support
  getSamlLoginUrl(): string {
    return `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/saml`;
  }

  validateSamlAssertion(assertion: string): Promise<{
    nameId: string;
    attributes: Record<string, string[]>;
  }> {
    // SAML validation would go here
    // For now, return mock
    return Promise.resolve({
      nameId: 'user@example.com',
      attributes: { email: ['user@example.com'], name: ['Test User'] },
    });
  }

  isEnabled(): boolean {
    return !!this.config.clientSecret;
  }
}