import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LookupService } from '../../../../../core/services/lookup.service';

interface DeptCard {
  name: string;
  icon: string;
}

const ICON_BY_CODE: Record<string, string> = {
  HOME: 'fa-landmark',
  RLR: 'fa-map-location-dot',
  FIN: 'fa-coins',
  TRN: 'fa-bus',
  GEN: 'fa-building-user',
  DGP: 'fa-shield-halved',
  PRISON: 'fa-building-lock',
  HOMEGUARD: 'fa-people-roof',
  FIRE: 'fa-fire-extinguisher',
  SAINIK: 'fa-medal',
  PROSEC: 'fa-scale-balanced'
};

/** Always shown after the departments: complaints can also go to branches and field offices. */
const COORDINATION_CARDS: DeptCard[] = [
  { name: 'संबंधित शाखाएँ', icon: 'fa-sitemap' },
  { name: 'क्षेत्रीय कार्यालय', icon: 'fa-building-circle-check' }
];

/** Used only if the departments API is unreachable. */
const FALLBACK_DEPARTMENTS: DeptCard[] = [
  { name: 'गृह विभाग', icon: 'fa-landmark' },
  { name: 'राजस्व एवं भूमि सुधार विभाग', icon: 'fa-map-location-dot' },
  { name: 'वित्त विभाग', icon: 'fa-coins' },
  { name: 'परिवहन विभाग', icon: 'fa-bus' },
  { name: 'पुलिस महानिदेशक का कार्यालय', icon: 'fa-shield-halved' },
  { name: 'कारा निदेशालय एवं सुधार सेवाएँ', icon: 'fa-building-lock' },
  { name: 'गृह रक्षा वाहिनी', icon: 'fa-people-roof' },
  { name: 'अग्निशमन निदेशालय', icon: 'fa-fire-extinguisher' },
  { name: 'सैनिक कल्याण निदेशालय', icon: 'fa-medal' },
  { name: 'अभियोजन निदेशालय', icon: 'fa-scale-balanced' }
];

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './departments.component.html',
  styleUrl: './departments.component.css'
})
export class DepartmentsComponent implements OnInit {
  private lookupService = inject(LookupService);

  departments: DeptCard[] = [...FALLBACK_DEPARTMENTS, ...COORDINATION_CARDS];

  ngOnInit(): void {
    this.lookupService.getDepartments().subscribe({
      next: (list) => {
        if (!list.length) return;
        const cards = list.map((d) => ({
          name: d.nameHindi || d.name,
          icon: ICON_BY_CODE[d.code] ?? 'fa-landmark'
        }));
        this.departments = [...cards, ...COORDINATION_CARDS];
      },
      error: () => {
        // keep the fallback list
      }
    });
  }
}
