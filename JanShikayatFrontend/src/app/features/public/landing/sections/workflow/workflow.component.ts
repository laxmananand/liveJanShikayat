import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workflow',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workflow.component.html',
  styleUrl: './workflow.component.css'
})
export class WorkflowComponent {
  steps = [
    {icon:'fa-file-circle-plus', title:'पंजीकृत', text:'आवेदक का विवरण एवं आवेदन पत्र दर्ज कर आवेदन संख्या जारी की जाती है।'},
    {icon:'fa-share', title:'अग्रेषित', text:'आवेदन को संबंधित शाखा, प्रशाखा या क्षेत्रीय कार्यालय को भेजा जाता है।'},
    {icon:'fa-hourglass-half', title:'लंबित', text:'संबंधित कार्यालय का प्रतिवेदन प्राप्त होता है और अंतिम निर्णय शेष रहता है।'},
    {icon:'fa-circle-check', title:'निष्पादित', text:'प्रतिवेदन के आधार पर आवेदन का निष्पादन कर उसे बंद किया जाता है।'}
  ];
}
