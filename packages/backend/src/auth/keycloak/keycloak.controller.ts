import { Controller, Get, Query, Redirect, Req, Res, HttpStatus } from '@nestjs/common';
import { KeycloakService } from './keycloak.service';
import { AuthService } from '../auth.service';

@Controller('auth/sso')
export class KeycloakController {
  constructor(
    private readonly keycloakService: KeycloakService,
    private readonly authService: AuthService,
  ) {}

  @Get('login')
  @Redirect()
  ssoLogin() {
    if (!this.keycloakService.isEnabled()) {
      return { url: '/api/auth/login' };
    }
    const state = Buffer.from(JSON.stringify({ timestamp: Date.now() })).toString('base64');
    return { url: this.keycloakService.getLoginUrl(state) };
  }

  @Get('callback')
  @Redirect()
  async ssoCallback(@Query('code') code: string, @Query('state') state: string) {
    if (!this.keycloakService.isEnabled()) {
      return { url: '/login?error=sso_not_configured' };
    }

    try {
      const tokens = await this.keycloakService.getToken(code);
      const userInfo = await this.keycloakService.getUserInfo(tokens.access_token);

      // Create or update user in our system
      const user = await this.authService.findOrCreateFromSSO({
        email: userInfo.email,
        name: userInfo.name || `${userInfo.given_name} ${userInfo.family_name}`,
        ssoId: userInfo.sub,
      });

      // Generate our JWT
      const jwt = await this.authService.generateToken(user);

      return {
        url: `/dashboard?token=${jwt.access_token}`,
      };
    } catch (error) {
      console.error('SSO callback error:', error);
      return { url: '/login?error=sso_failed' };
    }
  }

  @Get('saml')
  @Redirect()
  samlLogin() {
    if (!this.keycloakService.isEnabled()) {
      return { url: '/api/auth/login' };
    }
    return { url: this.keycloakService.getSamlLoginUrl() };
  }

  @Get('logout')
  @Redirect()
  async ssoLogout(@Query('refresh_token') refreshToken: string) {
    if (this.keycloakService.isEnabled() && refreshToken) {
      await this.keycloakService.logout(refreshToken);
    }
    return { url: '/login?logged_out=true' };
  }

  @Get('status')
  getSSOStatus() {
    return {
      enabled: this.keycloakService.isEnabled(),
      provider: 'keycloak',
    };
  }
}