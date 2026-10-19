import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, from, switchMap, tap } from "rxjs";
import { GoogleAuthService } from './google-auth.service';
export type AppUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "CLIENT" | "ADMIN";
  authProvider?: 'LOCAL' | 'GOOGLE';
};
export type ProfileUpdate = {
  name: string;
  phone: string;
  currentPassword?: string;
  newPassword?: string;
};
type Session = { accessToken: string; user: AppUser };
type ProfileSession = { accessToken?: string; user: AppUser };
@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly tokenKey = "jembatech_access_token";
  private readonly userKey = "jembatech_user";
  user?: AppUser = this.readUser();
  constructor(private readonly http: HttpClient, readonly google: GoogleAuthService) {}

  loginGoogle(currentPassword?: string): Observable<Session> {
    return from(this.google.popupToken()).pipe(
      switchMap(idToken => this.http.post<Session>(currentPassword ? '/api/auth/google/link' : '/api/auth/google',
        { idToken, ...(currentPassword ? { currentPassword } : {}) })),
      tap(session => this.save(session)),
    );
  }

  async googleToken(): Promise<string> {
    const token = await this.google.token();
    localStorage.setItem(this.tokenKey, token);
    return token;
  }
  register(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Observable<Session> {
    return this.http
      .post<Session>("/api/auth/register", data)
      .pipe(tap((s) => this.save(s)));
  }
  login(data: { email: string; password: string }): Observable<Session> {
    return this.http
      .post<Session>("/api/auth/login", data)
      .pipe(tap((s) => this.save(s)));
  }
  updateProfile(data: ProfileUpdate): Observable<ProfileSession> {
    return this.http
      .patch<ProfileSession>("/api/auth/me", data)
      .pipe(tap((s) => this.save(s)));
  }
  token() {
    return localStorage.getItem(this.tokenKey) ?? "";
  }
  logout() {
    void this.google.logout().catch(() => undefined);
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.user = undefined;
  }
  private save(session: ProfileSession) {
    if (session.accessToken) localStorage.setItem(this.tokenKey, session.accessToken);
    localStorage.setItem(this.userKey, JSON.stringify(session.user));
    this.user = session.user;
  }
  private readUser(): AppUser | undefined {
    try {
      const raw = localStorage.getItem(this.userKey);
      return raw ? (JSON.parse(raw) as AppUser) : undefined;
    } catch {
      return undefined;
    }
  }
}
