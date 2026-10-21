import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, from, switchMap, throwError, timer, of } from 'rxjs';
import { MOCK_USERS, MockUser } from './mock-credentials';
import { buildSeedComplaints, ComplaintRecord } from './mock-data';

/** Simulated network latency for every mock call (ms). */
export const MOCK_LATENCY_MS = 350;

const STORAGE_KEY = 'js_mock_db_v1';

interface MockDbState {
  complaints: ComplaintRecord[];
  /** Accounts created from the User Management screen (on top of MOCK_USERS). */
  extraUsers: MockUser[];
  nextComplaintId: number;
  nextDocumentId: number;
  nextRemarkId: number;
}

/**
 * In-browser stand-in for the old backend database (frontend-only template).
 *
 * Holds the complaint table in memory and mirrors it to localStorage so data
 * entered in the UI survives a page reload. Uploaded PDF files are kept in
 * memory only (lost on reload); missing files are replaced by a generated
 * sample PDF so the viewers always have something to show.
 *
 * Run `localStorage.removeItem('js_mock_db_v1')` in the browser console (or
 * call `reset()`) to go back to the seed data.
 *
 * TODO (API integration): delete the whole `core/mock` folder once every
 * service calls the real API.
 */
@Injectable({ providedIn: 'root' })
export class MockDbService {
  private state: MockDbState = this.load();
  private files = new Map<number, Blob>();

  // ---- Table access -------------------------------------------------------

  get complaints(): ComplaintRecord[] {
    return this.state.complaints;
  }

  get users(): MockUser[] {
    return [...MOCK_USERS, ...this.state.extraUsers];
  }

  addUser(user: MockUser): void {
    this.state.extraUsers.push(user);
    this.save();
  }

  insertComplaint(record: Omit<ComplaintRecord, 'id'>): ComplaintRecord {
    const created: ComplaintRecord = { ...record, id: this.state.nextComplaintId++ };
    this.state.complaints.push(created);
    this.save();
    return created;
  }

  /** "JS{year}{sequence}" e.g. JS20260013 — same format as the old backend. */
  nextComplaintNumber(): string {
    const prefix = `JS${new Date().getFullYear()}`;
    const used = this.state.complaints.filter((c) => c.complaintNumber.startsWith(prefix)).length;
    return `${prefix}${String(used + 1).padStart(4, '0')}`;
  }

  nextDocumentId(): number {
    return this.state.nextDocumentId++;
  }

  nextRemarkId(): number {
    return this.state.nextRemarkId++;
  }

  storeFile(documentId: number, file: Blob): void {
    this.files.set(documentId, file);
  }

  getFile(documentId: number): Blob | undefined {
    return this.files.get(documentId);
  }

  /** Persist after mutating a record in place. */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // storage unavailable (private mode / quota) — data just won't survive a reload
    }
  }

  reset(): void {
    this.state = this.seed();
    this.files.clear();
    this.save();
  }

  // ---- Persistence --------------------------------------------------------

  private load(): MockDbState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as MockDbState;
    } catch {
      // corrupt or unavailable storage — fall back to seed data
    }
    const seeded = this.seed();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    } catch {
      // ignore
    }
    return seeded;
  }

  private seed(): MockDbState {
    const complaints = buildSeedComplaints();
    const maxDoc = Math.max(0, ...complaints.flatMap((c) => c.documents.map((d) => d.id)));
    const maxRemark = Math.max(0, ...complaints.flatMap((c) => c.remarks.map((r) => r.id)));
    return {
      complaints,
      extraUsers: [],
      nextComplaintId: complaints.length + 1,
      nextDocumentId: maxDoc + 1,
      nextRemarkId: maxRemark + 1
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers shared by the mock services
// ---------------------------------------------------------------------------

/**
 * Runs `handler` after the simulated latency and emits its result (deep-copied,
 * so components can never mutate the mock tables). Throw `mockError(...)` from
 * the handler to emit an HttpErrorResponse, exactly like a failed API call.
 */
export function mockResponse<T>(handler: () => T | Promise<T>): Observable<T> {
  return timer(MOCK_LATENCY_MS).pipe(
    switchMap(() => {
      try {
        const result = handler();
        return result instanceof Promise ? from(result.then(clone)) : of(clone(result));
      } catch (err) {
        return throwError(() => err);
      }
    })
  );
}

/** Builds the same error shape the real HttpClient produces for a failed request. */
export function mockError(status: number, body: Record<string, unknown> = {}): HttpErrorResponse {
  const statusText: Record<number, string> = {
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 429: 'Too Many Requests'
  };
  return new HttpErrorResponse({ status, statusText: statusText[status] ?? 'Error', error: body, url: 'mock://api' });
}

function clone<T>(value: T): T {
  return value === undefined || value instanceof Blob ? value : JSON.parse(JSON.stringify(value));
}

/** Generates a small valid single-page PDF (ASCII text only) used as a stand-in document. */
export function buildSamplePdf(lines: string[]): Blob {
  const escape = (s: string) => s.replace(/[^\x20-\x7E]/g, '?').replace(/([\\()])/g, '\\$1');
  const text = lines
    .map((line, i) => `BT /F1 ${i === 0 ? 18 : 12} Tf 60 ${770 - i * 26} Td (${escape(line)}) Tj ET`)
    .join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}
