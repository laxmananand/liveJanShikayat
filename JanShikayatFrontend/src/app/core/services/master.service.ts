import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BlockMaster, District, MasterApiResponse, Panchayat, Thana, Village } from '../models/models';
import { environment } from '../../../environments/environment';
import { CachedRequest, CachedRequestMap } from '../utils/cached-request';
import {
  MstBranch,
  MstCategory,
  MstComplainSubType,
  MstDepartment,
  MstOfficeUnit,
  MstPrashakha,
  MstRegionalOffice
} from '../config/forward-options';

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

  // mst_thana columns (PS_Code, Police_Station, ...) are serialised with backend casing: map them once here
  private thanas = new CachedRequestMap((dist: number) => {
    const params = new HttpParams().set('District_Code', dist);
    return this.http.post<MasterApiResponse<any>>(`${this.baseUrl}/get-thana`, null, { params }).pipe(
      map(unwrap),
      map((rows) =>
        rows.map(
          (r): Thana => ({
            psCode: Number(r.pS_Code ?? r.ps_Code ?? r.PS_Code ?? r.psCode ?? 0),
            policeStation: r.police_Station ?? r.Police_Station ?? r.policeStation ?? '',
            districtCode: Number(r.district_code ?? r.District_code ?? r.districtCode ?? dist),
            subdivisionName: r.subdivision_Name ?? r.Subdivision_Name ?? '',
            circleName: r.circle_Name ?? r.Circle_Name ?? ''
          })
        )
      )
    );
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

  // District Administration: Mst_Regional_Office → vw_Office_Unit
  private regionalOffices = new CachedRequestMap((categoryId: number) => {
    const params = new HttpParams().set('CategoryId', categoryId);
    return this.http
      .post<MasterApiResponse<MstRegionalOffice>>(`${this.baseUrl}/get-regional-office`, null, { params })
      .pipe(map(unwrap));
  }, MASTER_TTL);
  private officeUnits = new CachedRequestMap((officeId: number) => {
    const params = new HttpParams().set('OfficeId', officeId);
    return this.http
      .post<MasterApiResponse<MstOfficeUnit>>(`${this.baseUrl}/get-office-unit`, null, { params })
      .pipe(map(unwrap));
  }, MASTER_TTL);

  /** API: POST /Master/get-regional-office?CategoryId= (cached per category) — Commissioner, DM, IG, DIG, SP */
  getRegionalOffices(categoryId: number): Observable<MstRegionalOffice[]> {
    return this.regionalOffices.get(categoryId);
  }

  /** API: POST /Master/get-office-unit?OfficeId= (cached per office) — empty while an office has no list yet */
  getOfficeUnits(officeId: number): Observable<MstOfficeUnit[]> {
    return this.officeUnits.get(officeId);
  }

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

  /** API: POST /Master/get-thana?District_Code= (cached per district) — police stations of a district */
  getThanas(districtCode: number): Observable<Thana[]> {
    return this.thanas.get(districtCode);
  }
}
