import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Captcha,
  PublicComplaintCreated,
  PublicComplaintPayload,
  PublicTimelineEntry,
  PublicTracking
} from '../models/models';
import { MockDbService, mockError, mockResponse } from '../mock/mock-db.service';
import { MOCK_DEPARTMENTS } from '../mock/mock-data';

const CAPTCHA_TTL_SECONDS = 300;
const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Anonymous endpoints used by the citizen-facing portal.
 *
 * MOCK IMPLEMENTATION — the CAPTCHA is drawn in the browser and complaints go
 * into MockDbService. Public method signatures match the old HTTP version; swap
 * each body for the HttpClient call noted above it when the new backend is ready.
 */
@Injectable({ providedIn: 'root' })
export class PublicService {
  private db = inject(MockDbService);
  private captchas = new Map<string, { code: string; expiresAt: number }>();

  /** API: GET /public/track/{complaintNumber} */
  track(complaintNumber: string): Observable<PublicTracking> {
    return mockResponse(() => {
      const number = complaintNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const complaint = this.db.complaints.find((c) => c.complaintNumber === number);
      if (!number || !complaint) throw mockError(404, { message: 'Complaint not found.' });

      const timeline: PublicTimelineEntry[] = [...complaint.history]
        .sort((a, b) => a.actionAt.localeCompare(b.actionAt))
        .map((h) => ({ status: h.toStatus as PublicTimelineEntry['status'], at: h.actionAt }));

      // Remarks move Pending -> UnderReview without a history row, so make sure
      // the current status is always the last timeline entry.
      if (!timeline.length || timeline[timeline.length - 1].status !== complaint.status) {
        timeline.push({ status: complaint.status, at: timeline.length ? timeline[timeline.length - 1].at : complaint.createdAt });
      }

      const dept = MOCK_DEPARTMENTS.find((d) => d.id === complaint.departmentId);
      return {
        complaintNumber: complaint.complaintNumber,
        status: complaint.status,
        registeredAt: complaint.createdAt,
        lastUpdatedAt: complaint.closedAt ?? timeline[timeline.length - 1].at,
        departmentName: dept?.name ?? null,
        departmentNameHindi: dept?.nameHindi ?? null,
        closedAt: complaint.closedAt ?? null,
        timeline
      };
    });
  }

  /** API: GET /public/captcha */
  captcha(): Observable<Captcha> {
    return mockResponse(() => {
      const code = Array.from({ length: 5 }, () => CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)]).join('');
      const captchaId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      this.captchas.set(captchaId, { code, expiresAt: Date.now() + CAPTCHA_TTL_SECONDS * 1000 });
      return { captchaId, image: drawCaptcha(code), expiresInSeconds: CAPTCHA_TTL_SECONDS };
    });
  }

  /** API: POST /public/complaints  (multipart: payload fields + optional PDF "file") */
  submitComplaint(payload: PublicComplaintPayload, file: File | null): Observable<PublicComplaintCreated> {
    return mockResponse(async () => {
      if (!this.consumeCaptcha(payload.captchaId, payload.captchaCode)) {
        throw mockError(400, { message: 'Invalid or expired captcha.', code: 'CAPTCHA_INVALID' });
      }
      if (payload.departmentId && !MOCK_DEPARTMENTS.some((d) => d.id === payload.departmentId)) {
        throw mockError(400, { message: 'Invalid department.' });
      }
      if (file) {
        const fileError = await validatePdf(file);
        if (fileError) throw mockError(400, { message: fileError });
      }

      const now = new Date().toISOString();
      const trim = (v?: string | null) => (v && v.trim() ? v.trim() : undefined);
      const record = this.db.insertComplaint({
        complaintNumber: this.db.nextComplaintNumber(),
        applicantName: payload.applicantName.trim(),
        guardianName: payload.guardianName.trim(),
        mobileNumber: payload.mobileNumber.trim(),
        email: trim(payload.email),
        address: payload.address.trim(),
        district: payload.district.trim(),
        block: payload.block.trim(),
        policeStation: trim(payload.policeStation),
        area: trim(payload.area),
        oppositeParty: trim(payload.oppositeParty),
        subject: payload.subject.trim(),
        category: payload.category.trim(),
        subCategory: trim(payload.subCategory),
        description: payload.description.trim(),
        complaintDate: now,
        source: 'Online',
        branchId: null,
        departmentId: payload.departmentId ?? null,
        competentAuthorityDesignationId: null,
        status: 'Pending',
        createdAt: now,
        documents: [],
        remarks: [],
        history: [
          { fromStatus: 'Pending', toStatus: 'Pending', reason: 'Complaint registered online by citizen.', actionByName: '', actionAt: now }
        ]
      });

      if (file) {
        const docId = this.db.nextDocumentId();
        record.documents.push({ id: docId, fileName: file.name, documentType: 'Complaint', uploadedAt: now });
        this.db.storeFile(docId, file);
        this.db.save();
      }

      return {
        complaintNumber: record.complaintNumber,
        registeredAt: record.createdAt,
        status: record.status,
        documentAttached: !!file
      };
    });
  }

  /** Single-use, case-insensitive check (same behaviour as the old server-side CAPTCHA). */
  private consumeCaptcha(id: string, code: string): boolean {
    const entry = this.captchas.get(id);
    this.captchas.delete(id);
    return !!entry && entry.expiresAt > Date.now() && entry.code === (code ?? '').trim().toUpperCase();
  }
}

async function validatePdf(file: File): Promise<string | null> {
  if (file.size === 0) return 'The uploaded file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) return 'The PDF must be 10 MB or smaller.';
  if (!file.name.toLowerCase().endsWith('.pdf')) return 'Only PDF files are allowed.';
  const header = await file.slice(0, 5).text();
  return header === '%PDF-' ? null : 'The uploaded file is not a valid PDF.';
}

/** Renders the CAPTCHA code as a noisy PNG data URL. */
function drawCaptcha(code: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  ctx.fillStyle = '#f9f5f3';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(${rand(80, 180)}, ${rand(80, 180)}, ${rand(80, 180)}, 0.6)`;
    ctx.beginPath();
    ctx.moveTo(rand(0, 160), rand(0, 50));
    ctx.lineTo(rand(0, 160), rand(0, 50));
    ctx.stroke();
  }

  ctx.font = 'bold 26px monospace';
  ctx.textBaseline = 'middle';
  [...code].forEach((ch, i) => {
    ctx.save();
    ctx.translate(18 + i * 28, 25 + rand(-4, 4));
    ctx.rotate(rand(-0.35, 0.35));
    ctx.fillStyle = ['#4a2c1f', '#7a1f1f', '#1f5c3a', '#4b2a7a'][i % 4];
    ctx.fillText(ch, -8, 0);
    ctx.restore();
  });

  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0, 0, 0, ${rand(0.1, 0.3)})`;
    ctx.fillRect(rand(0, 160), rand(0, 50), 2, 2);
  }
  return canvas.toDataURL('image/png');
}
