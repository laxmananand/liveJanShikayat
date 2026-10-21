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
    {icon:'fa-file-circle-plus', title:'शिकायत दर्ज करें', text:'शिकायत/आवेदन की आवश्यक आधारभूत जानकारी दर्ज की जाती है।'},
    {icon:'fa-cloud-arrow-up', title:'दस्तावेज़ अपलोड', text:'आवेदक विवरण, शिकायत पत्र और आवश्यक सहायक PDF संलग्न करें।'},
    {icon:'fa-share', title:'विभागीय अग्रेषण', text:'मामले को संबंधित विभाग, नोडल शाखा या अधिकारी को प्रेषित करें।'},
    {icon:'fa-building-user', title:'क्षेत्रीय स्तर समीक्षा', text:'संबंधित क्षेत्र/जिला कार्यालय एवं नोडल पदाधिकारी समीक्षा करते हैं।'},
    {icon:'fa-magnifying-glass-location', title:'Field Enquiry', text:'आवश्यकतानुसार शिकायत की सत्यता हेतु ग्राउंड लेवल जांच।'},
    {icon:'fa-comment-dots', title:'कार्रवाई व टिप्पणी', text:'की गई प्रशासनिक कार्रवाई एवं आधिकारिक टिप्पणियाँ दर्ज होती हैं।'},
    {icon:'fa-circle-check', title:'अंतिम निस्तारण', text:'अंतिम कार्रवाई पत्र जारी कर शिकायत को डिजिटल रूप से बंद किया जाता है।'}
  ];
}
