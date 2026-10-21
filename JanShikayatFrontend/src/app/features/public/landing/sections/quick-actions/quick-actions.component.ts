import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './quick-actions.component.html',
  styleUrl: './quick-actions.component.css'
})
export class QuickActionsComponent {
  private auth = inject(AuthService);

  get loggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  get adminLink(): string {
    return this.loggedIn ? '/dashboard' : '/login';
  }
}
