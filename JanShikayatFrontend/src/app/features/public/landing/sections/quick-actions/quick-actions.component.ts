import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../../core/services/auth.service';
import { FEATURES } from '../../../../../core/config/features';

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './quick-actions.component.html',
  styleUrl: './quick-actions.component.css'
})
export class QuickActionsComponent {
  private auth = inject(AuthService);

  /** The online complaint cards stay hidden until that form saves to the backend (FEATURES.onlineComplaint). */
  readonly onlineComplaint = FEATURES.onlineComplaint;

  get loggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  get adminLink(): string {
    return this.loggedIn ? '/dashboard' : '/login';
  }
}
