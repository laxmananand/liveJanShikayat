import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-features',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './features.component.html',
  styleUrl: './features.component.css'
})
export class FeaturesComponent {
  features = [
    {icon:'fa-file-pen', title:'डिजिटल शिकायत पंजीकरण', text:'आवेदक एवं शिकायत संबंधी आवश्यक विवरण सुरक्षित रूप से ऑनलाइन दर्ज करें।'},
    {icon:'fa-file-pdf', title:'PDF एवं दस्तावेज़', text:'शिकायत, आवश्यक सहायक दस्तावेज़ और फील्ड रिपोर्ट को डिजिटल रिकॉर्ड से जोड़ें।'},
    {icon:'fa-share-nodes', title:'अग्रेषण एवं समन्वय', text:'संबंधित विभाग, शाखा या सक्षम प्राधिकारी तक मामले को डिजिटल रूप से पहुँचाएँ।'},
    {icon:'fa-magnifying-glass-chart', title:'शिकायत निगरानी', text:'वर्तमान स्थिति और पूरी Processing History को स्तरवार पारदर्शी रूप से देखें।'},
    {icon:'fa-comments', title:'टिप्पणी एवं समीक्षा', text:'एडमिन और नोडल अधिकारियों की टिप्पणियों के साथ समीक्षा प्रक्रिया रिकॉर्ड करें।'},
    {icon:'fa-folder-closed', title:'केस क्लोजर', text:'अंतिम समयबद्ध कार्रवाई, रिपोर्ट और समापन टिप्पणी दर्ज कर केस क्लोज करें।'}
  ];
}
