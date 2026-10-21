import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FontSize, FontSizeService } from '../../../core/services/font-size.service';
import { PORTAL_CONTACT } from '../../../core/config/portal.config';

interface NavLink {
  id: string;
  icon: string;
  label: string;
  drawerLabel: string;
}

@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class PublicHeaderComponent {
  auth = inject(AuthService);
  fontSizeService = inject(FontSizeService);
  contact = PORTAL_CONTACT;

  isMobileNavOpen = false;
  activeNav = 'home';
  isScrolled = false;

  navLinks: NavLink[] = [
    { id: 'home', icon: 'fa-house-chimney', label: 'होम', drawerLabel: 'होम (Home)' },
    { id: 'register', icon: 'fa-pen-to-square', label: 'शिकायत दर्ज करें', drawerLabel: 'शिकायत दर्ज करें (Register)' },
    { id: 'track', icon: 'fa-magnifying-glass', label: 'शिकायत ट्रैक करें', drawerLabel: 'शिकायत ट्रैक करें (Track)' }
  ];

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled = window.scrollY > 20;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isMobileNavOpen) this.closeMobileNav();
  }

  get fontSize(): FontSize {
    return this.fontSizeService.size();
  }

  get adminLink(): string {
    return this.auth.isLoggedIn() ? '/dashboard' : '/login';
  }

  setFontSize(size: FontSize): void {
    this.fontSizeService.set(size);
  }

  toggleMobileNav(): void {
    this.isMobileNavOpen = !this.isMobileNavOpen;
    document.body.style.overflow = this.isMobileNavOpen ? 'hidden' : '';
  }

  closeMobileNav(): void {
    this.isMobileNavOpen = false;
    document.body.style.overflow = '';
  }

  setActive(navId: string): void {
    this.activeNav = navId;
    this.closeMobileNav();
  }
}
