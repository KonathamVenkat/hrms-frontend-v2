import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../../core/services/language.service';
import { formatDisplayDateTime } from '../../../../core/utils/display-date';
import { HistoryAction, RequestHistory } from '../../models/workflow.model';

const ICONS: Record<HistoryAction, string> = {
  SUBMITTED: 'send',
  FORWARDED: 'forward_to_inbox',
  APPROVED: 'check_circle',
  REJECTED: 'cancel',
  CANCELLED: 'remove_circle_outline',
  OVERRIDDEN: 'admin_panel_settings',
  AUTO_ROUTED: 'alt_route',
};

/** Steps of the default flow that have a translated name; a custom step shows no label rather than a raw key. */
const KNOWN_STEPS = ['BRANCH', 'SECRETARY', 'HEAD', 'GM', 'HR'];
/** Roles with a translated name (common.enums.role); any other role is shown as sent. */
const KNOWN_ROLES = ['HR_ADMIN', 'HR_MANAGER', 'GENERAL_MANAGER', 'EMPLOYEE', 'SYSTEM_ADMIN'];

/** One timeline row, worked out once so the template calls no methods. */
interface HistoryRow extends RequestHistory {
  key: string;
  icon: string;
  stepLabelKey: string | null;
  roleKey: string | null;
  when: string;
}

/** What happened to a request, oldest first. Every row names its action in text, never by colour alone. */
@Component({
  selector: 'app-history-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, TranslatePipe],
  templateUrl: './history-timeline.html',
  styleUrl: './history-timeline.css',
})
export class HistoryTimeline {
  readonly items = input.required<RequestHistory[]>();
  private readonly lang = inject(LanguageService);

  readonly rows = computed<HistoryRow[]>(() => {
    const lang = this.lang.currentLang();
    return this.items().map((h, i) => ({
      ...h,
      key: `${h.actedAt}|${h.action}|${h.stepKey ?? ''}|${i}`,
      icon: ICONS[h.action],
      stepLabelKey:
        h.stepKey && KNOWN_STEPS.includes(h.stepKey) ? `workflow.history.steps.${h.stepKey}` : null,
      roleKey:
        h.actorRole && KNOWN_ROLES.includes(h.actorRole)
          ? `common.enums.role.${h.actorRole}`
          : null,
      when: formatDisplayDateTime(h.actedAt, lang),
    }));
  });
}
