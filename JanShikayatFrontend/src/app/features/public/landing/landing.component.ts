import { Component } from '@angular/core';
import { HeroComponent } from './sections/hero/hero.component';
import { QuickActionsComponent } from './sections/quick-actions/quick-actions.component';
import { TrackingComponent } from './sections/tracking/tracking.component';
import { WatermarkComponent } from '../../../shared/watermark/watermark.component';

/** Public home page of the portal (remaining sections kept identical to design). */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    HeroComponent,
    QuickActionsComponent,
    TrackingComponent,
    WatermarkComponent
  ],
  template: `
    <app-hero></app-hero>
    <app-quick-actions></app-quick-actions>
    <app-tracking></app-tracking>

    <!-- Bihar Govt identity watermark: pinned to the viewport so it stays put while scrolling -->
    <div class="landing-watermark" aria-hidden="true">
      <app-watermark></app-watermark>
    </div>
  `,
  styles: `
    /* Above the sections (they paint opaque backgrounds) but below the sticky header; click-through */
    .landing-watermark {
      position: fixed;
      inset: 100px 0 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 50;
    }

    app-watermark {
      --wm-size: min(450px, 58vh);
      --wm-opacity: 0.7;
    }
  `
})
export class LandingComponent {}

