import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { LayoutComponent } from './shared/layout/layout.component';
import { PublicLayoutComponent } from './features/public/layout/public-layout.component';
import { LandingComponent } from './features/public/landing/landing.component';
import { PublicRegisterComponent } from './features/public/register/public-register.component';
import { LoginComponent } from './features/auth/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ComplaintListComponent } from './features/complaints/complaint-list/complaint-list.component';
import { EntryPageComponent } from './features/complaints/entry-page/entry-page.component';
import { ApplicantRecordsComponent } from './features/complaints/applicant-records/applicant-records.component';
import { TrackingPageComponent } from './features/complaints/tracking-page/tracking-page.component';
import { ComplaintDetailComponent } from './features/complaints/complaint-detail/complaint-detail.component';
import { UserManagementComponent } from './features/admin/user-management/user-management.component';

export const routes: Routes = [
  // ── Public citizen portal ──
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', component: LandingComponent, title: 'विभागीय जन शिकायत निदान पोर्टल | गृह विभाग, बिहार सरकार' },
      { path: 'register', component: PublicRegisterComponent, title: 'ऑनलाइन शिकायत दर्ज करें | जन शिकायत निदान पोर्टल' }
    ]
  },

  // ── Department login ──
  { path: 'login', component: LoginComponent, canActivate: [guestGuard], title: 'विभागीय लॉगिन | जन शिकायत निदान पोर्टल' },

  // ── Officer dashboard (authenticated) ──
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent, title: 'डैशबोर्ड | जन शिकायत निदान पोर्टल' },
      { path: 'complaints', component: ComplaintListComponent, title: 'शिकायतें | जन शिकायत निदान पोर्टल' },
      {
        path: 'complaints/entry',
        component: EntryPageComponent,
        // Only Admin may create new entries; the backend enforces the same rule
        canActivate: [roleGuard(['SuperAdmin'])],
        title: 'शिकायत प्रविष्टि (Entry Page) | जन शिकायत निदान पोर्टल'
      },
      {
        path: 'entry',
        redirectTo: 'complaints/entry',
        pathMatch: 'full'
      },
      {
        path: 'complaints/finalised',
        component: ApplicantRecordsComponent,
        title: 'अंतिम आवेदन | जन शिकायत निदान पोर्टल'
      },
      {
        path: 'complaints/records',
        redirectTo: 'complaints/finalised',
        pathMatch: 'full'
      },
      {
        path: 'complaints/tracking',
        component: TrackingPageComponent,
        title: 'शिकायत ट्रैकिंग (Grievance Tracking) | जन शिकायत निदान पोर्टल'
      },
      {
        path: 'tracking',
        redirectTo: 'complaints/tracking',
        pathMatch: 'full'
      },
      {
        path: 'complaints/new',
        redirectTo: 'complaints/entry',
        pathMatch: 'full'
      },
      { path: 'complaints/:id', component: ComplaintDetailComponent, title: 'शिकायत विवरण | जन शिकायत निदान पोर्टल' },
      {
        path: 'admin/users',
        component: UserManagementComponent,
        canActivate: [roleGuard(['SuperAdmin'])],
        title: 'उपयोगकर्ता प्रबंधन | जन शिकायत निदान पोर्टल'
      }
    ]
  },

  { path: '**', redirectTo: '' }
];
