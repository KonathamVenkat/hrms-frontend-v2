import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Auth } from '../auth/auth';

/**
 * The only address a stored photo can have: the employee's own photo endpoint, with the upload version.
 * It mirrors the backend rule, so nothing else is ever requested (the request carries the session token).
 */
const OWN_PHOTO_PATH = /^\/api\/v1\/employees\/\d+\/photo(\?v=\d+)?$/;

/**
 * Turns a stored `profilePhotoUrl` into something an `<img>` can show.
 *
 * An uploaded photo is an app-relative path that needs the signed-in session, so it is fetched
 * once through HttpClient and kept as an object URL; the list, the toolbar and the profile page
 * then share one request per photo. The path carries a version (`?v=`) that changes on every
 * upload, so a replaced photo is a new cache entry. Entries are keyed by the signed-in user too,
 * and everything is dropped, with its object URLs revoked, when the session is cleared, so a photo
 * loaded for one user is never handed to the next user of the same tab and does not stay in memory.
 */
@Injectable({ providedIn: 'root' })
export class PhotoCache {
  private http = inject(HttpClient);
  private auth = inject(Auth);
  private cache = new Map<string, Observable<string | null>>();
  private objectUrls = new Set<string>();
  /** Bumped on every clear, so a response that arrives after sign-out is discarded. */
  private epoch = 0;

  constructor() {
    this.auth.sessionCleared$.pipe(takeUntilDestroyed()).subscribe(() => this.clear());
  }

  /** The image address to show, or `null` when the photo cannot be loaded. Never errors. */
  load(photoUrl: string): Observable<string | null> {
    // Anything but the own photo path is never fetched: `//host/x` or `/\host/x` would leave this
    // origin with the session token, and an absolute address (only an old stored row can still hold
    // one) would reveal the viewer to another site.
    if (!OWN_PHOTO_PATH.test(photoUrl)) {
      return of(null);
    }
    const viewer = this.auth.getStoredUser()?.id;
    if (viewer === undefined) {
      return of(null);
    }
    const key = `${viewer}|${photoUrl}`;
    let photo$ = this.cache.get(key);
    if (!photo$) {
      const epoch = this.epoch;
      photo$ = this.http.get(`${environment.serviceUrl}${photoUrl}`, { responseType: 'blob' }).pipe(
        map((blob) => (epoch === this.epoch ? this.objectUrlFor(blob) : null)),
        catchError(() => of(null)),
        // A failed load is not remembered, so the next view tries again.
        tap((url) => url === null && this.cache.delete(key)),
        shareReplay(1),
      );
      this.cache.set(key, photo$);
    }
    return photo$;
  }

  private objectUrlFor(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.objectUrls.add(url);
    return url;
  }

  private clear(): void {
    this.epoch++;
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrls.clear();
    this.cache.clear();
  }
}
