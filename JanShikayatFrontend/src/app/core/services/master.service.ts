import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BlockMaster, District, MasterApiResponse, Panchayat, Village } from '../models/models';
import { environment } from '../../../environments/environment';
import { CachedRequest, CachedRequestMap } from '../utils/cached-request';
import { MstBranch, MstCategory, MstComplainSubType, MstDepartment, MstPrashakha } from '../config/forward-options';

/** Location masters almost never change: keep them for 30 minutes. */
const MASTER_TTL = 30 * 60_000;

/** "No data found" comes back as status "false" without data — treat it as an empty list. */
const unwrap = <T>(res: MasterApiResponse<T>): T[] => (res?.status === 'true' && res.data ? res.data : []);

/** Location masters served by the backend's MasterController (all POST, params in the query string). */
@Injectable({ providedIn: 'root' })
export class MasterService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/Master`;

  private districts = new CachedRequest(
    () => this.http.post<MasterApiResponse<District>>(`${this.baseUrl}/get-district`, null).pipe(map(unwrap)),
    MASTER_TTL
  );
  private blocks = new CachedRequestMap((dist: number) => {
    const params = new HttpParams().set('District_Code', dist);
    return this.http
      .post<MasterApiResponse<BlockMaster>>(`${this.baseUrl}/get-block`, null, { params })
      .pipe(map(unwrap));
  }, MASTER_TTL);
  private panchayats = new CachedRequestMap((key: string) => {
    const [dist, blk] = key.split('|');
    const params = new HttpParams().set('District_Code', dist).set('Block_code', blk);
    return this.http
      .post<MasterApiResponse<Panchayat>>(`${this.baseUrl}/get-panchayat`, null, { params })
      .pipe(map(unwrap));
  }, MASTER_TTL);
  private villages = new CachedRequestMap((key: string) => {
    const [dist, blk, pan] = key.split('|');
    const params = new HttpParams().set('District_Code', dist).set('Block_code', blk).set('PanchayatCode', pan);
    return this.http
      .post<MasterApiResponse<Village>>(`${this.baseUrl}/get-village`, null, { params })
      .pipe(map(unwrap));
  }, MASTER_TTL);

  // Forward popup cascade: Mst_Category → Mst_Branch → Mst_Complain_Sub_Type
  private forwardCategories = new CachedRequest(
    () => this.http.post<MasterApiResponse<MstCategory>>(`${this.baseUrl}/get-category`, null).pipe(map(unwrap)),
    MASTER_TTL
  );
  private branchesByCategory = new CachedRequestMap((categoryId: number) => {
    const params = new HttpParams().set('CategoryId', categoryId);
    return this.http
      .post<MasterApiResponse<MstBranch>>(`${this.baseUrl}/get-branch-by-category`, null, { params })
      .pipe(map(unwrap));
  }, MASTER_TTL);
  private complainSubTypes = new CachedRequestMap((complainId: number) => {
    const params = new HttpParams().set('ComplainId', complainId);
    return this.http
      .post<MasterApiResponse<MstComplainSubType>>(`${this.baseUrl}/get-complain-sub-type`, null, { params })
      .pipe(map(unwrap));
  }, MASTER_TTL);

  private departments = new CachedRequest(
    () => this.http.post<MasterApiResponse<MstDepartment>>(`${this.baseUrl}/get-department`, null).pipe(map(unwrap)),
    MASTER_TTL
  );

  private prashakhas = new CachedRequest(
    () => this.http.post<MasterApiResponse<MstPrashakha>>(`${this.baseUrl}/get-prashakha`, null).pipe(map(unwrap)),
    MASTER_TTL
  );

  /** API: POST /Master/get-prashakha (cached) — chosen first when forwarding under "Section" */
  getPrashakhas(): Observable<MstPrashakha[]> {
    return this.prashakhas.get();
  }

  /** API: POST /Master/get-department (cached) — targets of the "Department" forward category */
  getDepartments(): Observable<MstDepartment[]> {
    return this.departments.get();
  }

  /** API: POST /Master/get-category (cached) */
  getForwardCategories(): Observable<MstCategory[]> {
    return this.forwardCategories.get();
  }

  /** API: POST /Master/get-branch-by-category?CategoryId= (cached per category) */
  getBranchesByCategory(categoryId: number): Observable<MstBranch[]> {
    return this.branchesByCategory.get(categoryId);
  }

  /** API: POST /Master/get-complain-sub-type?ComplainId= (cached per branch) */
  getComplainSubTypes(complainId: number): Observable<MstComplainSubType[]> {
    return this.complainSubTypes.get(complainId);
  }

  /** API: POST /Master/get-district (cached) */
  getDistricts(): Observable<District[]> {
    return this.districts.get();
  }

  /** API: POST /Master/get-block?District_Code= (cached per district) */
  getBlocks(districtCode: number): Observable<BlockMaster[]> {
    return this.blocks.get(districtCode);
  }

  /** API: POST /Master/get-panchayat?District_Code=&Block_code= (cached per block) */
  getPanchayats(districtCode: number, blockCode: number): Observable<Panchayat[]> {
    return this.panchayats.get(`${districtCode}|${blockCode}`);
  }

  /** API: POST /Master/get-village?District_Code=&Block_code=&PanchayatCode= (cached per panchayat) */
  getVillages(districtCode: number, blockCode: number, panchayatCode: number): Observable<Village[]> {
    return this.villages.get(`${districtCode}|${blockCode}|${panchayatCode}`);
  }
}
