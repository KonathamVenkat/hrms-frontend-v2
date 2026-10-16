import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Sidebar } from '../sidebar/sidebar';
import { Toolbar } from '../toolbar/toolbar';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Sidebar, Toolbar, RouterOutlet, TranslatePipe],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
  host: { '(document:keydown.escape)': 'drawerOpen.set(false)' },
})
export class MainLayout {
  // Presentational shell state only: desktop rail shows labels / mobile drawer is open.
  protected readonly navExpanded = signal(false);
  protected readonly drawerOpen = signal(false);

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.drawerOpen.set(false));
  }
}
