// Gerenciamento de notificações não lidas para Agenda e Lessa Club
const SEEN_RESERVATIONS_KEY = 'admin_seen_reservation_ids_v2';
const SEEN_CLUB_SUBS_KEY = 'admin_seen_club_sub_ids_v2';
const BASELINE_INITIALIZED_KEY = 'admin_notifications_baseline_v2';

export const getSeenReservationIds = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SEEN_RESERVATIONS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

export const markReservationAsSeen = (idOrIds: string | string[]) => {
  if (!idOrIds || typeof window === 'undefined') return;
  const list = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  const set = getSeenReservationIds();
  let changed = false;
  list.forEach((id) => {
    if (id && !set.has(id)) {
      set.add(id);
      changed = true;
    }
  });
  if (changed) {
    try {
      localStorage.setItem(SEEN_RESERVATIONS_KEY, JSON.stringify(Array.from(set)));
      window.dispatchEvent(new CustomEvent('admin_notifications_updated'));
    } catch {}
  }
};

export const markAllReservationsAsSeen = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  const set = getSeenReservationIds();
  let changed = false;
  ids.forEach((id) => {
    if (id && !set.has(id)) {
      set.add(id);
      changed = true;
    }
  });
  if (changed) {
    try {
      localStorage.setItem(SEEN_RESERVATIONS_KEY, JSON.stringify(Array.from(set)));
      window.dispatchEvent(new CustomEvent('admin_notifications_updated'));
    } catch {}
  }
};

export const getSeenClubSubIds = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SEEN_CLUB_SUBS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

export const markClubSubAsSeen = (id: string) => {
  if (!id || typeof window === 'undefined') return;
  const set = getSeenClubSubIds();
  if (!set.has(id)) {
    set.add(id);
    try {
      localStorage.setItem(SEEN_CLUB_SUBS_KEY, JSON.stringify(Array.from(set)));
      window.dispatchEvent(new CustomEvent('admin_notifications_updated'));
    } catch {}
  }
};

export const markAllClubSubsAsSeen = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  const set = getSeenClubSubIds();
  let changed = false;
  ids.forEach((id) => {
    if (id && !set.has(id)) {
      set.add(id);
      changed = true;
    }
  });
  if (changed) {
    try {
      localStorage.setItem(SEEN_CLUB_SUBS_KEY, JSON.stringify(Array.from(set)));
      window.dispatchEvent(new CustomEvent('admin_notifications_updated'));
    } catch {}
  }
};

const BASELINE_RESERVATIONS_KEY = 'admin_res_baseline_v2';
const BASELINE_SUBS_KEY = 'admin_club_baseline_v2';

export const initializeReservationBaselineIfNeeded = (initialBookingIds: string[]) => {
  if (typeof window === 'undefined') return;
  const isInit = localStorage.getItem(BASELINE_RESERVATIONS_KEY);
  if (!isInit && initialBookingIds.length > 0) {
    markAllReservationsAsSeen(initialBookingIds);
    localStorage.setItem(BASELINE_RESERVATIONS_KEY, 'true');
  }
};

export const initializeClubBaselineIfNeeded = (initialSubIds: string[]) => {
  if (typeof window === 'undefined') return;
  const isInit = localStorage.getItem(BASELINE_SUBS_KEY);
  if (!isInit && initialSubIds.length > 0) {
    markAllClubSubsAsSeen(initialSubIds);
    localStorage.setItem(BASELINE_SUBS_KEY, 'true');
  }
};

export const initializeNotificationBaselineIfNeeded = (
  initialBookingIds: string[],
  initialSubIds: string[]
) => {
  if (initialBookingIds && initialBookingIds.length > 0) {
    initializeReservationBaselineIfNeeded(initialBookingIds);
  }
  if (initialSubIds && initialSubIds.length > 0) {
    initializeClubBaselineIfNeeded(initialSubIds);
  }
};

