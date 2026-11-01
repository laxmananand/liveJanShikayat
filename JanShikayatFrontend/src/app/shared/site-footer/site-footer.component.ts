import { Component } from '@angular/core';

/** Copyright + NIC strip at the bottom of every page: public portal, login and officer dashboard. */
@Component({
  selector: 'app-site-footer',
  standalone: true,
  template: `
    <footer class="footer-strip">
      <p>
        <span>© {{ year }}</span>
        <span>विभागीय जन शिकायत निदान पोर्टल</span>
        <span>अधिकृत गृह विभाग, बिहार सरकार</span>
        <span>सर्वाधिकार सुरक्षित</span>
      </p>
      <img src="assets/images/NIC-Logo.png" alt="National Informatics Centre" class="nic-logo" />
    </footer>
  `,
  styles: `
    :host {
      display: block;
    }

    .footer-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px 24px;
      padding: 12px 34px;
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      color: var(--color-text-muted);
      font-size: 0.8rem;
    }

    p {
      margin: 0;
      min-width: 0;
    }

    span + span::before {
      content: ' | ';
    }

    .nic-logo {
      height: 28px;
      width: auto;
      flex-shrink: 0;
    }

    @media (max-width: 768px) {
      .footer-strip {
        flex-direction: column;
        padding: 12px 14px;
        text-align: center;
        font-size: 0.74rem;
      }
    }

    @media print {
      :host {
        display: none;
      }
    }
  `
})
export class SiteFooterComponent {
  year = new Date().getFullYear();
}
