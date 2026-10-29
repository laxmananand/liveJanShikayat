import { AppRole } from '../models/models';

/**
 * STATIC LOGIN CREDENTIALS (frontend-only template).
 *
 * These replace the accounts the old backend seeded into its database. The mock
 * AuthService checks email + password against this list. Accounts created from
 * the "User Management" screen are added on top of these at runtime (stored in
 * the browser's localStorage by MockDbService).
 *
 * TODO (API integration): delete this file once AuthService calls the real login API.
 */
export interface MockUser {
  email: string;
  password: string;
  fullName: string;
  designation: string;
  role: AppRole;
  branchId: number | null;
  departmentId: number | null;
  isActive: boolean;
}

export const MOCK_USERS: MockUser[] = [
  {
    email: 'admin@janshikayat.gov.in',
    password: 'Admin@12345',
    fullName: 'Super Admin',
    designation: 'System Administrator',
    role: 'SuperAdmin',
    branchId: null,
    departmentId: null,
    isActive: true
  },
  {
    email: 'branchofficer1@janshikayat.gov.in',
    password: 'Branch@12345',
    fullName: 'Branch Officer 1',
    designation: 'Branch Officer',
    role: 'BranchOfficer',
    branchId: 1,
    departmentId: null,
    isActive: true
  },
  {
    email: 'homedept.head@janshikayat.gov.in',
    password: 'Dept@12345',
    fullName: 'Home Department Head',
    designation: 'Department Head',
    role: 'DepartmentHead',
    branchId: null,
    departmentId: 1, // HOME
    isActive: true
  },
  {
    email: 'sdo1@janshikayat.gov.in',
    password: 'Authority@12345',
    fullName: 'SDO Patna Sadar',
    designation: 'Sub-Divisional Officer',
    role: 'CompetentAuthority',
    branchId: null,
    departmentId: null,
    isActive: true
  }
];

/** Hindi role names for the one-click demo buttons on the login screen. */
export const DEMO_ROLE_LABELS: Record<AppRole, string> = {
  SuperAdmin: 'सुपर एडमिन',
  BranchOfficer: 'शाखा अधिकारी',
  DepartmentHead: 'विभागाध्यक्ष',
  CompetentAuthority: 'सक्षम प्राधिकारी (एसडीओ)',
  Commissioner: 'प्रमंडलीय आयुक्त',
  DistrictMagistrate: 'जिलाधिकारी'
};
