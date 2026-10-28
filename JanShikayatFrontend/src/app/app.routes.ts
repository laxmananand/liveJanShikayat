import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
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
import { ForwardedApplicationsComponent } from './features/complaints/forwarded-applications/forwarded-applications.component';
import { ForwardResponsesComponent } from './features/complaints/forward-responses/forward-responses.component';
import { TrackingPageComponent } from './features/complaints/tracking-page/tracking-page.component';
import { ComplaintDetailComponent } from './features/complaints/complaint-detail/complaint-detail.component';
import { UserManagementComponent } from './features/admin/user-management/user-management.component';
import { FEATURES } from './core/config/features';

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
      { path: 'complaints', component: ComplaintListComponent, canActivate: [roleGuard(['SuperAdmin'])], title: 'शिकायतें | जन शिकायत निदान पोर्टल' },
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
        canActivate: [roleGuard(['SuperAdmin'])],
        title: 'अंतिम आवेदन | जन शिकायत निदान पोर्टल'
      },
      {
        path: 'complaints/forwarded',
        component: ForwardedApplicationsComponent,
        title: 'अग्रेषित आवेदन | जन शिकायत निदान पोर्टल'
      },
      {
        path: 'complaints/responses',
        component: ForwardResponsesComponent,
        // Replies to Admin's forwards; only Admin closes applications (the backend enforces the same rule)
        canActivate: [roleGuard(['SuperAdmin'])],
        title: 'प्राप्त प्रतिवेदन | जन शिकायत निदान पोर्टल'
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
      { path: 'complaints/:id', component: ComplaintDetailComponent, canActivate: [roleGuard(['SuperAdmin'])], title: 'शिकायत विवरण | जन शिकायत निदान पोर्टल' },
      {
        path: 'admin/users',
        component: UserManagementComponent,
        // Temporarily hidden (FEATURES.userManagement): a direct URL goes to the dashboard
        canActivate: [() => FEATURES.userManagement || inject(Router).createUrlTree(['/dashboard']), roleGuard(['SuperAdmin'])],
        title: 'उपयोगकर्ता प्रबंधन | जन शिकायत निदान पोर्टल'
      }
    ]
  },

  { path: '**', redirectTo: '' }
];
