import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Branch, CompetentAuthorityDesignation, Department } from '../models/models';
import { mockResponse } from '../mock/mock-db.service';
import { MOCK_BRANCHES, MOCK_COMPETENT_AUTHORITIES, MOCK_DEPARTMENTS } from '../mock/mock-data';

/**
 * MOCK IMPLEMENTATION — returns the static lists in core/mock/mock-data.ts.
 * Swap each body for the HttpClient call noted above it when the API is ready.
 */
@Injectable({ providedIn: 'root' })
export class LookupService {
  /** API: GET /branches */
  getBranches(): Observable<Branch[]> {
    return mockResponse(() => MOCK_BRANCHES);
  }

  /** API: GET /departments (anonymous — also used by the public complaint form) */
  getDepartments(): Observable<Department[]> {
    return mockResponse(() => MOCK_DEPARTMENTS);
  }

  /** API: GET /competent-authorities */
  getCompetentAuthorities(): Observable<CompetentAuthorityDesignation[]> {
    return mockResponse(() => MOCK_COMPETENT_AUTHORITIES);
  }
}
