import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PublicService } from '../../../../../core/services/public.service';
import { PublicTracking } from '../../../../../core/models/models';
import { statusLabel, statusProgress } from '../../../../../core/utils/labels';
import { StatusFlowComponent } from '../../../../../shared/status-flow/status-flow.component';

@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusFlowComponent],
  templateUrl: './tracking.component.html',
  styleUrl: './tracking.component.css'
})
export class TrackingComponent implements OnInit {
  private publicService = inject(PublicService);
  private route = inject(ActivatedRoute);

  complaintId = '';
  searching = false;
  result: PublicTracking | null = null;
  errorMessage = '';

  statusLabel = statusLabel;
  statusProgress = statusProgress;

  ngOnInit(): void {
    // Deep link from the registration success screen: /?track=JS23014150001#track
    const prefill = this.route.snapshot.queryParamMap.get('track');
    if (prefill) {
      this.complaintId = prefill;
      this.search();
    }
  }

  search(): void {
    // Numbers used to contain dashes (JS-2026-0001); accept them as typed.
    const id = this.complaintId.replace(/[\s-]/g, '').toUpperCase();
    if (!id) {
      this.errorMessage = 'कृपया अपनी शिकायत संख्या दर्ज करें।';
      return;
    }

    this.searching = true;
    this.errorMessage = '';
    this.result = null;

    this.publicService.track(id).subscribe({
      next: (res) => {
        this.result = res;
        this.searching = false;
      },
      error: (err: HttpErrorResponse) => {
        this.searching = false;
        if (err.status === 404) {
          this.errorMessage = `"${id}" संख्या की कोई शिकायत नहीं मिली। कृपया संख्या जांच कर पुनः प्रयास करें।`;
        } else if (err.status === 429) {
          this.errorMessage = 'बहुत अधिक प्रयास हुए हैं। कृपया एक मिनट बाद पुनः प्रयास करें।';
        } else {
          this.errorMessage = 'सर्वर से संपर्क नहीं हो सका। कृपया कुछ देर बाद पुनः प्रयास करें।';
        }
      }
    });
  }

  clear(): void {
    this.result = null;
    this.errorMessage = '';
  }

  timelineLabel(index: number, status: string): string {
    return index === 0 ? 'शिकायत पंजीकृत' : statusLabel(status);
  }
}
