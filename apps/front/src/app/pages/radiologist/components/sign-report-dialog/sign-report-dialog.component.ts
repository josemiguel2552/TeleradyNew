import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { SignatureCanvasComponent } from '../signature-canvas/signature-canvas.component';
import type { SignRequest } from '../../services/report-v2.service';

@Component({
  selector: 'app-sign-report-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    SignatureCanvasComponent,
  ],
  template: `
    <p-dialog
      [visible]="visible"
      [closable]="true"
      [modal]="true"
      [draggable]="false"
      header="Sign report"
      (visibleChange)="visibleChange.emit($event)"
      [style]="{ width: '36rem' }"
    >
      <div class="policy">
        <p-tag [value]="policy" severity="info"></p-tag>
      </div>

      <div class="form">
        <label>
          Displayed name
          <input
            type="text"
            pInputText
            [ngModel]="displayedName()"
            (ngModelChange)="displayedName.set($event)"
            placeholder="Defaults to your profile"
          />
        </label>
        <label>
          Collegiate number
          <input
            type="text"
            pInputText
            [ngModel]="collegiate()"
            (ngModelChange)="collegiate.set($event)"
            placeholder="Defaults to your profile"
          />
        </label>

        <ng-container *ngIf="policy === 'drawn_hash_tsa'">
          <p class="hint">Draw your signature once. We will hash the bundle and timestamp it.</p>
          <app-signature-canvas (drawingChange)="drawing.set($event)"></app-signature-canvas>
        </ng-container>
      </div>

      <ng-template pTemplate="footer">
        <button pButton type="button" label="Cancel" severity="secondary" (click)="visibleChange.emit(false)"></button>
        <button
          pButton
          type="button"
          label="Sign"
          [disabled]="!canSign()"
          (click)="submit()"
        ></button>
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      .policy { margin-bottom: 0.75rem; }
      .form { display: flex; flex-direction: column; gap: 0.75rem; }
      label { display: flex; flex-direction: column; font-size: 0.85rem; gap: 0.25rem; }
      .hint { color: #666; margin: 0; }
    `,
  ],
})
export class SignReportDialogComponent {
  @Input() visible = false;
  @Input() policy: 'name_collegiate' | 'drawn_hash_tsa' = 'name_collegiate';

  @Output() readonly visibleChange = new EventEmitter<boolean>();
  @Output() readonly sign = new EventEmitter<SignRequest>();

  readonly displayedName = signal<string>('');
  readonly collegiate = signal<string>('');
  readonly drawing = signal<string>('');

  canSign(): boolean {
    if (this.policy === 'drawn_hash_tsa' && !this.drawing()) return false;
    return true;
  }

  submit(): void {
    const body: SignRequest = {
      policy: this.policy,
      displayedName: this.displayedName() || undefined,
      collegiate: this.collegiate() || undefined,
    };
    if (this.policy === 'drawn_hash_tsa') body.drawn = { drawingBase64: this.drawing() };
    this.sign.emit(body);
  }
}
