/**
 * Forwarding targets for an application: category → branch → complaint type.
 * Loaded from the DB masters (Mst_Category → Mst_Branch → Mst_Complain_Sub_Type) via MasterService.
 */

export interface ForwardOption {
  id: string;
  label: string;
}

/** POST /Master/get-category */
export interface MstCategory {
  autoId: number;
  category_Id: number;
  category: string;
}

/** POST /Master/get-branch-by-category?CategoryId= */
export interface MstBranch {
  complain_id: number;
  branch_Eng: string;
  branch_Hindi: string;
}

/** POST /Master/get-department (Mst_Departments) */
export interface MstDepartment {
  departmentId: number;
  departmentName: string;
  email: string | null;
  email2: string | null;
}

/** POST /Master/get-prashakha (Mst_Prashakha) */
export interface MstPrashakha {
  id: number;
  name: string;
}

/** POST /Master/get-complain-sub-type?ComplainId= */
export interface MstComplainSubType {
  sub_Type_id: number;
  complain_Id: number;
  sub_Type: string;
}
