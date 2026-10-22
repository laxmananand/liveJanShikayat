import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FontSizeService } from '../../core/services/font-size.service';
import { roleLabel } from '../../core/utils/labels';
import { FEATURES } from '../../core/config/features';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  auth = inject(AuthService);
  fontSize = inject(FontSizeService);
  private router = inject(Router);

  sidebarCollapsed = false;
  sidebarMobileOpen = false;
  userMenuOpen = false;

  roleLabel = roleLabel;

  private url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  get isComplaintsPage(): boolean {
    return this.router.parseUrl(this.url()).root.children['primary']?.segments.map((s) => s.path).join('/') === 'complaints';
  }

  toggleSidebar(): void {
    if (window.innerWidth <= 768) {
      this.sidebarMobileOpen = !this.sidebarMobileOpen;
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    }
  }

  closeMobileSidebar(): void {
    this.sidebarMobileOpen = false;
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeUserMenu(): void {
    this.userMenuOpen = false;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /** All complaints and Finalised Applications are Admin-only; other users work from their forwarded applications. */
  get isAdmin(): boolean {
    return this.auth.hasRole('SuperAdmin');
  }

  /** New entries are Admin-only; other roles only view and add remarks. */
  get canRegisterComplaint(): boolean {
    return this.auth.hasRole('SuperAdmin');
  }

  /** Temporarily off via FEATURES.userManagement. */
  get canManageUsers(): boolean {
    return FEATURES.userManagement && this.auth.hasRole('SuperAdmin');
  }

  getUserInitials(): string {
    const user = this.auth.currentUser();
    if (!user) return '?';
    const parts = user.fullName.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return user.fullName.substring(0, 2).toUpperCase();
  }
}
