import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PORTAL_CONTACT } from '../../../../../core/config/portal.config';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.css'
})
export class HeroComponent {
  contact = PORTAL_CONTACT;
  /** Illustrative reference number shown on the showcase card (matches the real JSYYYYNNNN format). */
  sampleRef = `JS${new Date().getFullYear()}0001`;

  activeTab: 'status' | 'guide' | 'helpline' = 'status';
  copiedId = false;

  setTab(tab: 'status' | 'guide' | 'helpline'): void {
    this.activeTab = tab;
  }

  copyRefId(id: string): void {
    navigator.clipboard?.writeText(id).then(() => {
      this.copiedId = true;
      setTimeout(() => (this.copiedId = false), 2200);
    });
  }
}
