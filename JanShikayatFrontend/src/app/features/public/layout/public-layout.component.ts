import { Component, HostListener, inject } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PublicHeaderComponent } from '../header/header.component';
import { PublicFooterComponent } from '../footer/footer.component';
import { SiteFooterComponent } from '../../../shared/site-footer/site-footer.component';

/** Shell for the citizen-facing pages: landing page and online complaint form. */
@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, PublicHeaderComponent, PublicFooterComponent, SiteFooterComponent],
  template: `
    <app-public-header></app-public-header>
    <main class="main-content">
      <router-outlet></router-outlet>
    </main>
    <app-public-footer></app-public-footer>
    <app-site-footer></app-site-footer>

    <button
      class="back-top"
      [class.show]="showTop"
      (click)="scrollTop()"
      aria-label="ऊपर जाएँ"
      title="ऊपर जाएँ">
      <i class="fa-solid fa-arrow-up"></i>
    </button>
  `,
  styleUrl: './public-layout.component.css'
})
export class PublicLayoutComponent {
  showTop = false;

  constructor() {
    // Keep anchor jumps (#about, #track, …) clear of the sticky header.
    inject(ViewportScroller).setOffset([0, 100]);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.showTop = window.scrollY > 500;
  }

  scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
