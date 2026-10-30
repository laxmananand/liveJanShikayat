import { Component } from '@angular/core';


@Component({
  selector: 'app-watermark',
  standalone: true,
  template: `
    <div class="wm-figure">
      <div class="wm-glow"></div>
      <img src="assets/images/buddha-watermark.png" alt="" draggable="false" />
    </div>

    <div class="wm-lockup">
      <div class="wm-title-row">
        <span class="wm-rule"></span>
        <span class="wm-title">बिहार सरकार</span>
        <span class="wm-rule"></span>
      </div>
      <span class="wm-sub">✦ गृह विभाग ✦</span>
    </div>
  `,
  styles: `
    :host {
      --wm-size: 440px;
      --wm-opacity: 1;
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
      display: grid;
      place-items: center;
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
      background: radial-gradient(circle, rgba(255, 196, 64, 0.16) 0%, rgba(255, 196, 64, 0.06) 38%, transparent 68%);
    }

    img {
      position: relative;
      height: 100%;
      width: auto;
      opacity: 0.22;
      /* let the lotus base dissolve into the lockup */
      -webkit-mask-image: linear-gradient(to bottom, #000 72%, transparent 100%);
      mask-image: linear-gradient(to bottom, #000 72%, transparent 100%);
    }

    .wm-lockup {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: calc(var(--wm-size) * -0.02);
    }

    .wm-title-row {
      display: flex;
      align-items: center;
      gap: calc(var(--wm-size) * 0.03);
    }

    .wm-rule {
      width: calc(var(--wm-size) * 0.14);
      height: 1.5px;
      background: linear-gradient(90deg, transparent, rgba(18, 57, 143, 0.35));
    }

    .wm-rule:last-child {
      transform: scaleX(-1);
    }

    .wm-title {
      font-size: calc(var(--wm-size) * 0.085);
      font-weight: 800;
      letter-spacing: 0.06em;
      line-height: 1.25;
      white-space: nowrap;
      background: linear-gradient(180deg, rgba(23, 75, 217, 0.3), rgba(12, 40, 110, 0.22));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .wm-sub {
      margin-top: 2px;
      font-size: calc(var(--wm-size) * 0.032);
      font-weight: 700;
      letter-spacing: 0.04em;
      white-space: nowrap;
      color: rgba(18, 57, 143, 0.28);
    }

    @media print {
      :host {
        display: none;
      }
    }
  `
})
export class WatermarkComponent {}
