import { Component } from '@angular/core';


@Component({
  selector: 'app-watermark',
  standalone: true,
  template: `
    <div class="wm-figure">
      <div class="wm-glow"></div>
      <div class="wm-lotus-glow"></div>
      <img src="assets/images/buddha-watermark.png" alt="" draggable="false" />
      <!-- same artwork again, cropped to the lotus seat, to give the lotus extra colour and depth -->
      <img class="wm-lotus" src="assets/images/buddha-watermark.png" alt="" draggable="false" />
      <!-- and cropped to the face, for hosts that set --wm-face-opacity -->
      <img class="wm-face" src="assets/images/buddha-watermark.png" alt="" draggable="false" />
    </div>
  `,
  styles: `
    :host {
      --wm-size: 440px;
      --wm-opacity: 1;
      --wm-image-opacity: 0.28;
      --wm-face-opacity: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      opacity: var(--wm-opacity);
      pointer-events: none;
      user-select: none;
    }

    .wm-figure {
      position: relative;
      height: var(--wm-size);
      aspect-ratio: 360 / 528;
    }

    /* glow is centred on the halo behind the head */
    .wm-glow {
      position: absolute;
      left: 50%;
      top: 22%;
      aspect-ratio: 1;
      transform: translate(-50%, -50%);
      width: 115%;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 190, 50, 0.26) 0%, rgba(255, 190, 50, 0.1) 40%, transparent 68%);
    }

    /* soft rose bloom under the lotus seat */
    .wm-lotus-glow {
      position: absolute;
      left: 50%;
      top: 84%;
      width: 125%;
      height: 34%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(236, 110, 155, 0.26) 0%, rgba(236, 110, 155, 0.1) 45%, transparent 70%);
    }

    img {
      position: absolute;
      inset: 0;
      height: 100%;
      width: 100%;
      opacity: var(--wm-image-opacity);
      filter: saturate(1.35) contrast(1.05);
    }

    .wm-lotus {
      opacity: 0.32;
      filter: saturate(2.2) contrast(1.2) drop-shadow(0 0 6px rgba(236, 110, 155, 0.35));
      -webkit-mask-image: linear-gradient(to bottom, transparent 66%, #000 78%);
      mask-image: linear-gradient(to bottom, transparent 66%, #000 78%);
    }

    .wm-face {
      opacity: var(--wm-face-opacity);
      filter: saturate(1.25) contrast(1.1);
      -webkit-mask-image: radial-gradient(ellipse 15% 15% at 50% 26%, #000 60%, transparent 100%);
      mask-image: radial-gradient(ellipse 15% 15% at 50% 26%, #000 60%, transparent 100%);
    }

    @media print {
      :host {
        display: none;
      }
    }
  `
})
export class WatermarkComponent {}
