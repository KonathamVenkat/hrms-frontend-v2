import { Component, OnInit, signal, inject, computed, DestroyRef, ChangeDetectionStrategy } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CalendarDay, CalendarMonth } from '../../models/leave-calendar.model';
import { LeaveRequestService } from '../../services/leave-request.service';

@Component({
  selector: 'app-leave-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './leave-calendar.html',
  styleUrl: './leave-calendar.css',
})
export class LeaveCalendarPage implements OnInit {
  private leaveService = inject(LeaveRequestService);
  private destroy = inject(DestroyRef);
  private translate = inject(TranslateService);

  // ── State ─────────────────────────────────────────────────
  calendar = signal<CalendarMonth | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  // ── Current view ──────────────────────────────────────────
  viewYear = signal(new Date().getFullYear());
  viewMonth = signal(new Date().getMonth() + 1); // 1-based

  // ── Selected day for detail popup ─────────────────────────
  selectedDay = signal<CalendarDay | null>(null);

  // ── Week headers — Mon–Sun (Sat/Sun weekend) ──────
  readonly weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  // ── Computed calendar grid (7 cols) ───────────────────────
  readonly weeks = computed(() => {
    const days = this.calendar()?.days ?? [];
    const result: CalendarDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  });

  ngOnInit(): void {
    this.loadCalendar();
  }

  // ── Load ──────────────────────────────────────────────────
  loadCalendar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.selectedDay.set(null);

    this.leaveService
      .getCalendar(this.viewYear(), this.viewMonth())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (res) => {
          if (res.success) this.calendar.set(res.data);
          else this.error.set(res.message);
        },
        error: (err: { error?: { message?: string } }) =>
          this.error.set(
            err?.error?.message || this.translate.instant('leave.calendar.errors.loadFailed'),
          ),
      });
  }

  // ── Navigation ────────────────────────────────────────────
  prevMonth(): void {
    if (this.viewMonth() === 1) {
      this.viewMonth.set(12);
      this.viewYear.update((y) => y - 1);
    } else {
      this.viewMonth.update((m) => m - 1);
    }
    this.loadCalendar();
  }

  nextMonth(): void {
    if (this.viewMonth() === 12) {
      this.viewMonth.set(1);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.update((m) => m + 1);
    }
    this.loadCalendar();
  }

  goToToday(): void {
    this.viewYear.set(new Date().getFullYear());
    this.viewMonth.set(new Date().getMonth() + 1);
    this.loadCalendar();
  }

  // ── Day click ─────────────────────────────────────────────
  selectDay(day: CalendarDay): void {
    if (this.selectedDay()?.date === day.date) {
      this.selectedDay.set(null); // toggle off
    } else {
      this.selectedDay.set(day);
    }
  }

  closePopup(): void {
    this.selectedDay.set(null);
  }

  // ── Helpers ───────────────────────────────────────────────
  getTypeColor(code: string): string {
    const map: Record<string, string> = {
      ANNUAL: '#0a7466',
      SICK: '#be123c',
      CASUAL: '#92400e',
      MATERNITY: '#6d28d9',
      PATERNITY: '#06b6d4',
      COMP_OFF: '#047857',
      HAJJ: '#c2410c',
      BEREAVEMENT: '#5b6270',
      STUDY: '#1d4ed8',
      UNPAID: '#64748b',
    };
    return map[code] ?? '#64748b';
  }

  getHolidayColor(type: string): string {
    const map: Record<string, string> = {
      PUBLIC: '#be123c',
      RELIGIOUS: '#6d28d9',
      OPTIONAL: '#92400e',
      RESTRICTED: '#06b6d4',
    };
    return map[type] ?? '#64748b';
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getDayClass(day: CalendarDay): string {
    const classes: string[] = ['cal-day'];
    if (!day.isCurrentMonth) classes.push('other-month');
    if (day.isWeekend) classes.push('weekend');
    if (day.isHoliday) classes.push('holiday');
    if (day.isToday) classes.push('today');
    if (day.onLeaveCount > 0) classes.push('has-leaves');
    if (this.selectedDay()?.date === day.date) classes.push('selected');
    return classes.join(' ');
  }
}
