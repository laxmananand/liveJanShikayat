import { Component } from '@angular/core';
import { HeroComponent } from './sections/hero/hero.component';
import { QuickActionsComponent } from './sections/quick-actions/quick-actions.component';
import { TrackingComponent } from './sections/tracking/tracking.component';

/** Public home page of the portal (remaining sections kept identical to design). */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    HeroComponent,
    QuickActionsComponent,
    TrackingComponent
  ],
  template: `
    <app-hero></app-hero>
    <app-quick-actions></app-quick-actions>
    <app-tracking></app-tracking>
  `
})
export class LandingComponent {}

