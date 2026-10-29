import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { AppRole, CurrentUser, LoginResponse } from '../models/models';
import { MockDbService, mockError, mockResponse } from '../mock/mock-db.service';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'js_auth_token';
const USER_KEY = 'js_auth_user';
const ALL_ROLES: AppRole[] = ['SuperAdmin', 'BranchOfficer', 'DepartmentHead', 'CompetentAuthority', 'Commissioner', 'DistrictMagistrate'];

/** Expiry time (ms since epoch) from the JWT's `exp` claim; null if the token cannot be read. */
function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const exp = JSON.parse(atob(payload)).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** A token that is missing, unreadable or past its expiry is not a session. */
function isTokenValid(token: string | null): token is string {
  if (!token) return false;
  const exp = tokenExpiry(token);
  return exp !== null && exp > Date.now();
}

/** Backend captcha challenge (GET /Auth/generate-captcha). */
export interface CaptchaChallenge {
  captchaId: string;
  captchaImage: string; // data:image/svg+xml;base64,...
}

/** Backend login envelope (POST /Auth/login → { status, message, data }). */
interface BackendLoginEnvelope {
  status: boolean;
  message: string;
  data?: {
    authToken: string;
    userid: string;
    username: string;
    role: string; // Mst_Role.Role name ("Admin", "Branch", "Saction"); older builds sent the numeric Id
    branchId?: number | null; // Tbl_UserLogin.Branch_Id (Mst_Branch.Complain_id) for branch logins
    prashakhaId?: number | null; // Tbl_UserLogin.Prashakha_Id (Mst_Prashakha.ID) for Prashakha logins
    officeId?: number | null; // Tbl_UserLogin.Office_Id (1 = Commissionary, 2 = DM) for Commissioner / DM logins
    officeUnitCode?: number | null; // Tbl_UserLogin.Office_Unit_Code (division code / district code)
  };
}

interface BackendCaptchaEnvelope {
  status: boolean;
  captchaId: string;
  captchaImage: string;
}

/** Map the backend's role (Mst_Role name, or its numeric Id) to the frontend AppRole. */
function mapRole(code: string | null | undefined): AppRole {
  switch ((code ?? '').trim().toLowerCase()) {
    case 'admin':
    case '2':
      return 'SuperAdmin';
    case 'branch':
    case '3':
      return 'DepartmentHead';
    case 'commissioner':
      return 'Commissioner';
    case 'dm':
      return 'DistrictMagistrate';
    case 'saction':
    case '1':
    default:
      return 'BranchOfficer';
  }
}

export interface RegisterUserPayload {
  email: string;
  password: string;
  fullName: string;
  designation?: string;
  role: string;
  branchId?: number | null;
  departmentId?: number | null;
}

/**
 * MOCK IMPLEMENTATION — credentials are checked against core/mock/mock-credentials.ts.
 * Public method signatures match the old HTTP version; swap the bodies marked
 * "API:" for HttpClient calls when the new backend is ready.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private db = inject(MockDbService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private authUrl = `${environment.apiUrl}/Auth`;
  private expiryTimer?: ReturnType<typeof setTimeout>;

  currentUser = signal<CurrentUser | null>(this.readStoredUser());

  constructor() {
    // Opening the app after the session ran out (e.g. the next day) starts from the login page
    if (!isTokenValid(localStorage.getItem(TOKEN_KEY))) {
      this.clearSession();
    } else {
      this.scheduleExpiry();
    }
  }

  /** API: GET /Auth/generate-captcha → { captchaId, captchaImage } */
  generateCaptcha(): Observable<CaptchaChallenge> {
    return this.http
      .get<BackendCaptchaEnvelope>(`${this.authUrl}/generate-captcha`)
      .pipe(map((res) => ({ captchaId: res.captchaId, captchaImage: res.captchaImage })));
  }

  /** API: POST /Auth/verify-captcha { CaptchaId, CaptchaCode } → { status, message } */
  verifyCaptcha(captchaId: string, captchaCode: string): Observable<{ status: boolean; message: string }> {
    return this.http.post<{ status: boolean; message: string }>(`${this.authUrl}/verify-captcha`, {
      CaptchaId: captchaId,
      CaptchaCode: captchaCode
    });
  }

  /** API: POST /Auth/login { UserName, Password, CaptchaId, CaptchaCode } → LoginResponse */
  login(userName: string, password: string, captchaId: string, captchaCode: string): Observable<LoginResponse> {
    return this.http
      .post<BackendLoginEnvelope>(`${this.authUrl}/login`, {
        UserName: userName,
        Password: password,
        CaptchaId: captchaId,
        CaptchaCode: captchaCode
      })
      .pipe(
        map((res) => {
          if (!res.status || !res.data) {
            throw new Error(res.message || 'Invalid username or password.');
          }
          const d = res.data;
          const expiresAt = new Date(tokenExpiry(d.authToken) ?? Date.now() + 60 * 60_000).toISOString();
          const resp: LoginResponse = {
            token: d.authToken,
            expiresAt,
            email: d.username,
            fullName: d.username,
            role: mapRole(d.role),
            branchId: d.branchId ?? null,
            departmentId: null,
            prashakhaId: d.prashakhaId ?? null,
            officeId: d.officeId ?? null,
            officeUnitCode: d.officeUnitCode ?? null
          };
          return resp;
        }),
        tap((res) => {
          localStorage.setItem(TOKEN_KEY, res.token);
          const user: CurrentUser = {
            email: res.email,
            fullName: res.fullName,
            role: res.role,
            branchId: res.branchId,
            departmentId: res.departmentId,
            prashakhaId: res.prashakhaId ?? null,
            officeId: res.officeId ?? null,
            officeUnitCode: res.officeUnitCode ?? null
          };
          localStorage.setItem(USER_KEY, JSON.stringify(user));
          this.currentUser.set(user);
          this.scheduleExpiry();
        })
      );
  }

  /** API: POST /auth/register (SuperAdmin only) → { message } */
  register(payload: RegisterUserPayload): Observable<{ message: string }> {
    return mockResponse(() => {
      if (!this.hasRole('SuperAdmin')) throw mockError(403, { message: 'Forbidden.' });
      if (!ALL_ROLES.includes(payload.role as AppRole)) throw mockError(400, { message: 'Invalid role.' });
      if (this.db.users.some((u) => u.email.toLowerCase() === payload.email.toLowerCase())) {
        throw mockError(400, { errors: [`Username '${payload.email}' is already taken.`] });
      }
      if (!payload.password || payload.password.length < 6) {
        throw mockError(400, { errors: ['Passwords must be at least 6 characters.'] });
      }
      this.db.addUser({
        email: payload.email,
        password: payload.password,
        fullName: payload.fullName,
        designation: payload.designation ?? '',
        role: payload.role as AppRole,
        branchId: payload.branchId ?? null,
        departmentId: payload.departmentId ?? null,
        isActive: true
      });
      return { message: 'User created.' };
    });
  }

  /** API: POST /Auth/logout. Clears the local session regardless of the server's reply. */
  logout(): void {
    if (isTokenValid(this.getToken())) {
      // Fire-and-forget: the server invalidates its session; we never block on it.
      this.http.post(`${this.authUrl}/logout`, {}).subscribe({ next: () => {}, error: () => {} });
    }
    this.clearSession();
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /** Logged in only while the token is still valid; an expired one is cleared on the spot. */
  isLoggedIn(): boolean {
    if (isTokenValid(this.getToken())) return true;
    if (this.getToken() || this.currentUser()) this.clearSession();
    return false;
  }

  /** Local sign-out only: no server call (an expired token would just be rejected). */
  private clearSession(): void {
    clearTimeout(this.expiryTimer);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
  }

  /** Sign out and go to the login page the moment the token expires, even if the user is idle. */
  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    const token = this.getToken();
    const exp = token ? tokenExpiry(token) : null;
    if (exp === null) return;
    // setTimeout overflows past ~24.8 days; re-check then if a token ever lives that long
    const delay = Math.min(Math.max(exp - Date.now(), 0), 2_147_000_000);
    this.expiryTimer = setTimeout(() => {
      if (isTokenValid(this.getToken())) {
        this.scheduleExpiry();
        return;
      }
      this.clearSession();
      this.router.navigate(['/login']);
    }, delay);
  }

  hasRole(...roles: string[]): boolean {
    const user = this.currentUser();
    return !!user && roles.includes(user.role);
  }

  private readStoredUser(): CurrentUser | null {
    if (!isTokenValid(localStorage.getItem(TOKEN_KEY))) return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}
