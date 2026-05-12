import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

/**
 * Lightweight canvas-based signature pad. Captures pointer/touch events,
 * draws on a 2D canvas and emits a base64 PNG without the data URL prefix.
 *
 * Kept dependency-free on purpose — bringing in something like signature_pad
 * would only save ~30 lines and adds a transitive surface we don't need.
 */
@Component({
  selector: 'app-signature-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule],
  template: `
    <div class="signature">
      <canvas
        #canvas
        [width]="width"
        [height]="height"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerUp($event)"
        (pointerleave)="onPointerUp($event)"
      ></canvas>
      <div class="actions">
        <button pButton type="button" label="Clear" severity="secondary" (click)="clear()"></button>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .signature canvas {
        border: 1px solid #d4d4d8;
        border-radius: 6px;
        background: #fff;
        touch-action: none;
        width: 100%;
        max-width: 480px;
        cursor: crosshair;
        display: block;
      }
      .actions { margin-top: 0.5rem; }
    `,
  ],
})
export class SignatureCanvasComponent implements AfterViewInit {
  @Input() width = 480;
  @Input() height = 200;
  @Output() readonly drawingChange = new EventEmitter<string>();

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx: CanvasRenderingContext2D | null = null;
  private drawing = false;
  private hasInk = false;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
    this.ctx = ctx;
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.ctx) return;
    this.canvasRef.nativeElement.setPointerCapture(event.pointerId);
    this.drawing = true;
    const { x, y } = this.pointAt(event);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drawing || !this.ctx) return;
    const { x, y } = this.pointAt(event);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.hasInk = true;
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.drawing) return;
    this.drawing = false;
    try {
      this.canvasRef.nativeElement.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore: capture might not have been set if pointercancel fires first.
    }
    if (this.hasInk) this.drawingChange.emit(this.exportPng());
  }

  clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    this.hasInk = false;
    this.drawingChange.emit('');
  }

  private exportPng(): string {
    const dataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  }

  private pointAt(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const scaleX = this.canvasRef.nativeElement.width / rect.width;
    const scaleY = this.canvasRef.nativeElement.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }
}
