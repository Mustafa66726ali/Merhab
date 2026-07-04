import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
const api = axios.create({ baseURL: API, headers: { "Content-Type": "application/json" } });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const path = config.url || "";
    const isPublicAuth =
      path.includes("/auth/login/") || path.includes("/auth/register/");
    if (isPublicAuth) {
      delete config.headers.Authorization;
    } else {
      const token = localStorage.getItem("access_token");
      if (token) config.headers.Authorization = "Bearer " + token;
    }
  }
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});
export default api;

export const authAPI = {
  login: (email: string, password: string) => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("platform_info");
    }
    return api.post(
      "/auth/login/",
      {
        email: email.trim().toLowerCase(),
        password: password.trim(),
      },
      { headers: { Authorization: undefined } }
    );
  },
  me: () => api.get("/auth/me/"),
  updateProfile: (data: Record<string, unknown>) => api.patch("/auth/update_me/", data),
  changePassword: (current_password: string, new_password: string) =>
    api.post("/auth/change_password/", { current_password, new_password }),
  setRecoveryEmail: (recovery_email_enabled: boolean) =>
    api.patch("/auth/recovery-email/", { recovery_email_enabled }),
  setTwoFactor: (two_factor_enabled: boolean) =>
    api.patch("/auth/two-factor/", { two_factor_enabled }),
  recoveryStatus: () =>
    api.get<{ configured: boolean }>("/auth/recovery-status/", {
      headers: { Authorization: undefined },
    }),
  forgotPassword: (email: string) =>
    api.post<{ detail: string }>(
      "/auth/forgot-password/",
      { email: email.trim().toLowerCase() },
      { headers: { Authorization: undefined } }
    ),
  resetPassword: (email: string, code: string, new_password: string) =>
    api.post<{ detail: string }>(
      "/auth/reset-password/",
      {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        new_password: new_password.trim(),
      },
      { headers: { Authorization: undefined } }
    ),
};

export const eventsAPI = {
  list: (params?: Record<string, unknown>) => api.get("/events/events/", { params }),
  get: (id: number) => api.get<EventDetail>("/events/events/" + id + "/"),
  create: (data: Record<string, unknown> | FormData) => api.post("/events/events/", data),
  update: (id: number, data: Record<string, unknown> | FormData) =>
    api.patch(`/events/events/${id}/`, data),
  delete: (id: number) => api.delete(`/events/events/${id}/`),
  overview: (params?: Record<string, unknown>) =>
    api.get<EventsOverview>("/events/events/overview/", { params }),
  groupsOverview: (id: number) =>
    api.get<EventGroupsOverviewResponse>(`/events/events/${id}/groups-overview/`),
  exportGroupsGuests: async (id: number) => {
    const res = await api.get(`/events/events/${id}/export-groups-guests/`, {
      responseType: "blob",
    });
    return res.data as Blob;
  },
  seatingOverview: (id: number) =>
    api.get<EventSeatingOverviewResponse>(`/events/events/${id}/seating-overview/`),
  start: (id: number) => api.post<EventDetail>(`/events/events/${id}/start/`),
  end: (id: number) => api.post<EventDetail>(`/events/events/${id}/end/`),
  getLiveMedia: (id: number) => api.get<EventLiveMedia>(`/events/events/${id}/live-media/`),
  updateLiveMedia: (id: number, data: FormData) =>
    api.patch<EventLiveMedia>(`/events/events/${id}/live-media/`, data),
  startLiveStream: (id: number) =>
    api.post<EventLiveMedia>(`/events/events/${id}/live-media/stream-start/`),
  uploadLiveStreamChunk: (id: number, data: FormData) =>
    api.post<EventLiveMedia>(`/events/events/${id}/live-media/stream-chunk/`, data),
  stopLiveStream: (id: number) =>
    api.post<EventLiveMedia>(`/events/events/${id}/live-media/stream-stop/`),
  sendBroadcastLink: (id: number) =>
    api.post<BroadcastSendResult>(`/events/events/${id}/live-media/send-link/`),
};

export const sectionsAPI = {
  create: (data: {
    event: number;
    name: string;
    color?: string;
    description?: string;
    location?: string;
    order?: number;
  }) => api.post("/events/sections/", data),
  update: (
    id: number,
    data: Partial<{
      name: string;
      color: string;
      description: string;
      location: string;
      order: number;
    }>
  ) => api.patch(`/events/sections/${id}/`, data),
  delete: (id: number) => api.delete(`/events/sections/${id}/`),
};

export const groupsAPI = {
  create: (data: {
    event: number;
    section?: number | null;
    name: string;
    location?: string;
    color?: string;
    description?: string;
  }) => api.post("/events/groups/", data),
  update: (
    id: number,
    data: Partial<{
      name: string;
      location: string;
      color: string;
      description: string;
      section: number | null;
    }>
  ) => api.patch(`/events/groups/${id}/`, data),
  delete: (id: number) => api.delete(`/events/groups/${id}/`),
};

export const schedulesAPI = {
  list: (params?: { event?: number }) =>
    api.get("/events/schedules/", { params }),
  create: (data: {
    event: number;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    location?: string;
    order?: number;
  }) => api.post<EventScheduleItem>("/events/schedules/", data),
  update: (
    id: number,
    data: Partial<{
      title: string;
      description: string;
      start_time: string;
      end_time: string;
      location: string;
      order: number;
    }>
  ) => api.patch<EventScheduleItem>(`/events/schedules/${id}/`, data),
  delete: (id: number) => api.delete(`/events/schedules/${id}/`),
};

export const guestsAPI = {
  list: (params?: Record<string, unknown>) => api.get("/guests/", { params }),
  stats: (params?: Record<string, unknown>) =>
    api.get<GuestListStats>("/guests/stats/", { params }),
  get: (id: number) => api.get<EventGuestDetail>(`/guests/${id}/`),
  create: (data: Record<string, unknown>) => api.post("/guests/", data),
  update: (id: number, data: Record<string, unknown>) => api.put("/guests/" + id + "/", data),
  patch: (id: number, data: Record<string, unknown>) => api.patch(`/guests/${id}/`, data),
  delete: (id: number) => api.delete("/guests/" + id + "/"),
  importGuests: (guests: Record<string, unknown>[]) =>
    api.post("/guests/import_guests/", { guests }),
  checkIn: (id: number) => api.post<EventGuestDetail>(`/guests/${id}/check_in/`),
  scan: (token: string) =>
    api.post<EventGuestDetail & { already_checked_in?: boolean }>("/guests/scan/", {
      token,
    }),
  directory: (params?: { search?: string; exclude_event?: number }) =>
    api.get<GuestDirectoryEntry[]>("/guests/directory/", { params }),
};

export interface GuestDirectoryEntry {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  event_count: number;
  last_event_title: string;
}

export const tablesAPI = {
  list: (params?: Record<string, unknown>) =>
    api.get<EventTableRow[] | { results?: EventTableRow[] }>("/tables/tables/", { params }),
  create: (data: {
    event: number;
    plan?: number | null;
    section?: number | null;
    group?: number | null;
    name: string;
    capacity?: number;
    shape?: string;
    position_x?: number;
    position_y?: number;
  }) => api.post<EventTableRow>("/tables/tables/", data),
  update: (id: number, data: Record<string, unknown>) =>
    api.patch<EventTableRow>(`/tables/tables/${id}/`, data),
  delete: (id: number) => api.delete(`/tables/tables/${id}/`),
  assign: (id: number, data: { guest_id: number; seat_number?: number }) =>
    api.post<EventTableRow>(`/tables/tables/${id}/assign/`, data),
  unassign: (id: number, data: { guest_id?: number; seat_number?: number }) =>
    api.post<EventTableRow>(`/tables/tables/${id}/unassign/`, data),
  scanSeat: (id: number, data: { token: string; seat_number?: number }) =>
    api.post<EventTableRow & { seated_guest?: { id: number; full_name: string } }>(
      `/tables/tables/${id}/scan-seat/`,
      data
    ),
};

// ===== الدعوات (Invitations) =====
export interface InvitationTemplate {
  event: number;
  invitation_title: string;
  invitation_message: string;
  default_template: string;
  auto_reminder_enabled?: boolean;
  auto_reminder_hours_before?: number;
  auto_reminder_sent_at?: string | null;
  placeholders: string[];
}

export interface InvitationSendResult {
  guest_id: number;
  full_name: string;
  phone: string;
  invite_url: string;
  message: string;
  whatsapp_url: string | null;
  auto?: boolean;
  sent?: boolean;
  detail?: string;
}

export interface InvitationReminderResult extends InvitationSendResult {
  status: string;
  kind: "confirmed" | "unconfirmed";
}

export interface WhatsappBotStatus {
  provider: "manual" | "bot" | "api" | "cloud" | "twilio" | string;
  configured?: string;
  label?: string;
  automated?: boolean;
  ready: boolean;
  state?: string;
  queue?: number;
  error?: string;
}

export const invitationsAPI = {
  getTemplate: (eventId: number) =>
    api.get<InvitationTemplate>("/invitations/template/", { params: { event: eventId } }),
  saveTemplate: (data: {
    event: number;
    invitation_title: string;
    invitation_message: string;
    auto_reminder_enabled?: boolean;
    auto_reminder_hours_before?: number;
  }) => api.put<InvitationTemplate>("/invitations/template/", data),
  botStatus: () => api.get<WhatsappBotStatus>("/invitations/bot-status/"),
  sendOne: (data: { guest_id: number; message: string; kind?: "invite" | "remind" }) =>
    api.post<{
      guest_id: number;
      sent: boolean;
      detail: string;
      whatsapp_url: string | null;
    }>("/invitations/send-one/", data),
  sendBatch: (data: {
    event: number;
    guest_ids?: number[];
    section?: number | null;
    group?: number | null;
    title?: string;
    message?: string;
    auto?: boolean;
  }) =>
    api.post<{ count: number; auto: boolean; invitations: InvitationSendResult[] }>(
      "/invitations/send-batch/",
      data
    ),
  remindBatch: (data: {
    event: number;
    guest_ids?: number[];
    section?: number | null;
    group?: number | null;
    message_unconfirmed?: string;
    message_confirmed?: string;
    auto?: boolean;
  }) =>
    api.post<{
      count: number;
      skipped: number;
      auto: boolean;
      reminders: InvitationReminderResult[];
    }>("/invitations/remind-batch/", data),
};

// ===== الدعوة العامة (Public RSVP — بدون مصادقة) =====
export interface PublicInvitationSchedule {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
}

export interface PublicInvitationGroupMember {
  full_name: string;
  initials: string;
  going: boolean;
  declined: boolean;
  is_self: boolean;
}

export interface PublicInvitationCoordinator {
  name: string;
  phone: string;
  whatsapp_url: string | null;
}

export interface PublicLiveMedia {
  enabled: boolean;
  mode: "off" | "audio_file" | "youtube" | "microphone" | "camera";
  mode_label: string;
  audio_url: string | null;
  youtube_embed_url: string | null;
  youtube_url: string | null;
  stream_active: boolean;
  stream_url: string | null;
  stream_kind: "audio" | "video" | null;
  stream_rev: number;
  broadcast_url?: string | null;
}

export type EventLiveMedia = PublicLiveMedia;

export interface BroadcastSendResult {
  ok: boolean;
  broadcast_url: string;
  total: number;
  sent: number;
  skipped: number;
  failed: number;
  manual_pending?: number;
  results: Array<{
    guest_id: number;
    full_name: string;
    status: string;
    sent: boolean;
    skipped?: boolean;
    detail: string;
    whatsapp_url?: string | null;
  }>;
}

export interface PublicBroadcast {
  event: {
    title: string;
    cover_image: string | null;
    platform_name: string;
  };
  live_media: PublicLiveMedia;
}

export const publicBroadcastAPI = {
  get: (token: string) => api.get<PublicBroadcast>(`/public/broadcast/${token}/`),
  liveMedia: (token: string) =>
    api.get<PublicLiveMedia>(`/public/broadcast/${token}/live-media/`),
};

export interface PublicInvitation {
  guest: {
    full_name: string;
    status: string;
    status_label: string;
    section_name: string;
    group_name: string;
    greeting: string;
    responded_at: string | null;
  };
  event: {
    title: string;
    description: string;
    date: string;
    time: string;
    end_date: string | null;
    end_time: string | null;
    venue: string;
    geo_address: string;
    latitude: number | null;
    longitude: number | null;
    location: string;
    cover_image: string | null;
    platform_name: string;
    invitation_title: string;
    invitation_message: string;
  };
  schedules: PublicInvitationSchedule[];
  group_members: PublicInvitationGroupMember[];
  coordinator: PublicInvitationCoordinator | null;
  live_media: PublicLiveMedia;
  qr_url: string | null;
  can_respond: boolean;
}

export const publicInvitationAPI = {
  get: (token: string) => api.get<PublicInvitation>(`/public/invitation/${token}/`),
  liveMedia: (token: string) =>
    api.get<PublicLiveMedia>(`/public/invitation/${token}/live-media/`),
  respond: (token: string, action: "confirm" | "decline") =>
    api.post<PublicInvitation>(`/public/invitation/${token}/respond/`, { action }),
  greeting: (token: string, message: string) =>
    api.post<{ ok: boolean; greeting: string }>(
      `/public/invitation/${token}/greeting/`,
      { message }
    ),
  inquiry: (token: string, message: string) =>
    api.post<{ ok: boolean }>(`/public/invitation/${token}/inquiry/`, { message }),
};

export interface SeatingPlanRow {
  id: number;
  event: number;
  name: string;
  description: string;
  order: number;
  tables_count: number;
  created_at: string;
}

export const seatingPlansAPI = {
  list: (eventId: number) =>
    api.get<SeatingPlanRow[] | { results?: SeatingPlanRow[] }>("/tables/plans/", {
      params: { event: eventId },
    }),
  create: (data: { event: number; name: string; description?: string; order?: number }) =>
    api.post<SeatingPlanRow>("/tables/plans/", data),
  update: (id: number, data: Partial<{ name: string; description: string; order: number }>) =>
    api.patch<SeatingPlanRow>(`/tables/plans/${id}/`, data),
  delete: (id: number) => api.delete(`/tables/plans/${id}/`),
};

export const usersAPI = {
  list: (params?: Record<string, unknown>) => api.get("/users/", { params }),
};

export interface Platform {
  id: number;
  name: string;
  owner: number;
  owner_name: string;
  owner_email: string;
  status: "active" | "blocked";
  description?: string;
  events_count: number;
  members_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformStats {
  total: number;
  blocked: number;
  most_active: { id: number; name: string; events_count: number; members_count: number } | null;
  least_active: { id: number; name: string; events_count: number; members_count: number } | null;
}

export const platformsAPI = {
  list: (params?: Record<string, unknown>) =>
    api.get<{ results?: Platform[]; count?: number } | Platform[]>("/platforms/platforms/", { params }),
  stats: () => api.get<PlatformStats>("/platforms/platforms/stats/"),
  get: (id: number) => api.get<Platform>(`/platforms/platforms/${id}/`),
  create: (data: {
    name: string;
    owner_email: string;
    owner_name?: string;
    owner_password?: string;
    status: string;
    description?: string;
  }) => api.post<Platform>("/platforms/platforms/", data),
  update: (id: number, data: Record<string, unknown>) =>
    api.patch<Platform>(`/platforms/platforms/${id}/`, data),
  delete: (id: number) => api.delete(`/platforms/platforms/${id}/`),
  export: (params?: Record<string, unknown>) =>
    api.get("/platforms/platforms/export/", { params, responseType: "blob" }),
  overview: (id: number) => api.get<PlatformOverview>(`/platforms/platforms/${id}/overview/`),
  staff: (id: number) => api.get<PlatformStaffResponse>(`/platforms/platforms/${id}/staff/`),
  allStaff: () => api.get<AllPlatformStaffResponse>("/platforms/platforms/all-staff/"),
  systemOverview: () => api.get<SystemOverview>("/platforms/platforms/system-overview/"),
  myOverview: () => api.get<PlatformMyOverview>("/platforms/platforms/my-overview/"),
  myMemberOverview: () =>
    api.get<EventManagerMyOverview>("/platforms/platforms/my-member-overview/"),
  myOrganizerOverview: () =>
    api.get<EventManagerMyOverview>("/platforms/platforms/my-organizer-overview/"),
  myMemberTeam: () =>
    api.get<EventManagerTeamListResponse>("/platforms/platforms/my-member-team/"),
  myStaffTeam: () =>
    api.get<EventManagerStaffTeamResponse>("/platforms/platforms/my-staff-team/"),
  myStaffTeamAdd: (data: FormData | EventManagerStaffCreatePayload) =>
    api.post<EventManagerStaffRow>("/platforms/platforms/my-staff-team/add/", data),
  myStaffTeamRemove: (userId: number) =>
    api.delete(`/platforms/platforms/my-staff-team/${userId}/remove/`),
  myStaffTeamAssignEvent: (userId: number, eventId: number) =>
    api.post<EventManagerStaffRow>(
      `/platforms/platforms/my-staff-team/${userId}/assign-event/`,
      { event_id: eventId }
    ),
  myStaffTeamUnassignEvent: (userId: number, eventId: number) =>
    api.delete<EventManagerStaffRow>(
      `/platforms/platforms/my-staff-team/${userId}/events/${eventId}/`
    ),
  myManagedEvents: (params?: Record<string, unknown>) =>
    api.get<{ total: number; events: ManagedEventRow[] }>(
      "/platforms/platforms/my-managed-events/",
      { params }
    ),
  myMemberEvents: () =>
    api.get<PlatformMyEventsResponse>("/platforms/platforms/my-member-events/"),
  myOrganizerEvents: () =>
    api.get<PlatformMyEventsResponse>("/platforms/platforms/my-organizer-events/"),
  myMemberSections: () =>
    api.get<MemberSectionsDashboard>("/platforms/platforms/my-member-sections/"),
  myReports: () =>
    api.get<ReportsDashboardData>("/platforms/platforms/my-reports/"),
  myEvents: () =>
    api.get<PlatformMyEventsResponse>("/platforms/platforms/my-events/"),
  mySettings: () =>
    api.get<PlatformMySettings>("/platforms/platforms/my-settings/"),
  mySettingsUpdate: (data: Partial<PlatformMySettingsUpdate> | FormData) =>
    api.patch<PlatformMySettings>("/platforms/platforms/my-settings/", data),
  myStaff: () => api.get<PlatformMyStaffResponse>("/platforms/platforms/my-staff/"),
  myPermissions: () =>
    api.get<PlatformMemberPermissions>("/platforms/platforms/my-permissions/"),
  myStaffAdd: (data: FormData | {
    email: string;
    first_name?: string;
    last_name?: string;
    role_key: string;
    password: string;
  }) => api.post<PlatformStaffMember>("/platforms/platforms/my-staff/add/", data),
  myStaffDetail: (userId: number) =>
    api.get<PlatformTeamMemberDetail>(
      `/platforms/platforms/my-staff/${userId}/detail/`
    ),
    myStaffUpdate: (
    userId: number,
    data: FormData | {
      email?: string;
      first_name?: string;
      last_name?: string;
      role_key?: string;
      password?: string;
      account_status?: string;
    }
  ) =>
    api.patch<PlatformStaffMember>(
      `/platforms/platforms/my-staff/${userId}/update/`,
      data
    ),
  myStaffRemove: (userId: number) =>
    api.delete(`/platforms/platforms/my-staff/${userId}/remove/`),
  myStaffTogglePermission: (
    userId: number,
    permission: "scan_qr" | "edit_guests" | "send_messages",
    enabled: boolean
  ) =>
    api.patch<PlatformStaffMember>(
      `/platforms/platforms/my-staff/${userId}/permission/`,
      { permission, enabled }
    ),
  myStaffProfile: (userId: number) =>
    api.get<PlatformMemberProfileResponse>(
      `/platforms/platforms/my-staff/${userId}/profile/`
    ),
  myStaffMessages: (userId: number, params?: MemberActivityFilters) =>
    api.get<PlatformMemberMessagesResponse>(
      `/platforms/platforms/my-staff/${userId}/messages/`,
      { params }
    ),
  myStaffQrScans: (userId: number, params?: MemberActivityFilters) =>
    api.get<PlatformMemberQrScansResponse>(
      `/platforms/platforms/my-staff/${userId}/qr-scans/`,
      { params }
    ),
  myStaffManagedEvents: (userId: number, params?: MemberManagedEventFilters) =>
    api.get<PlatformMemberManagedEventsResponse>(
      `/platforms/platforms/my-staff/${userId}/managed-events/`,
      { params }
    ),
  myStaffExport: (userId: number, format: "xlsx" | "pdf") =>
    api.get(`/platforms/platforms/my-staff/${userId}/export/`, {
      params: { format },
      responseType: "blob",
    }),
  sendMessage: (id: number, body: string, subject?: string) =>
    api.post(`/platforms/platforms/${id}/send-message/`, { body, subject }),
  sendNotification: (id: number, title: string, body: string) =>
    api.post(`/platforms/platforms/${id}/send-notification/`, { title, body }),
};

export interface DirectMessage {
  id: number;
  sender: number;
  sender_name: string;
  recipient: number;
  recipient_name: string;
  platform: number | null;
  platform_name: string;
  subject: string;
  body: string;
  parent_id: number | null;
  is_read: boolean;
  is_outgoing?: boolean;
  direction?: "incoming" | "outgoing";
  direction_label?: string;
  delivery_status?: "pending" | "delivered" | "failed";
  delivery_status_label?: string;
  delivered_at?: string | null;
  read_at?: string | null;
  is_delivered?: boolean;
  is_opened?: boolean;
  created_at: string;
}

export interface MessageListStats {
  total: number;
  inbox: number;
  outbox: number;
  inbox_unread: number;
  inbox_read: number;
  outbox_opened: number;
  outbox_not_opened: number;
  delivered: number;
  pending: number;
  failed: number;
}

export interface MessageListFilters {
  box?: "inbox" | "outbox" | "all";
  is_read?: "true" | "false";
  delivery_status?: "pending" | "delivered" | "failed";
  opened?: "true" | "false";
}

export interface MessageContact {
  id: number;
  name: string;
  email: string;
  role_label: string;
  platform_name?: string;
}

export interface GuestMessageContact {
  id: number;
  name: string;
  phone: string;
  email: string;
  event_id: number;
  event_title: string;
  whatsapp_url: string;
}

export interface GuestMessageItem {
  id: number;
  event: number;
  guest: number;
  guest_name: string;
  sender: number | null;
  sender_name: string;
  recipient?: number | null;
  recipient_name?: string;
  direction: string;
  direction_label?: string;
  kind?: string;
  kind_label?: string;
  content: string;
  is_read: boolean;
  created_at: string;
  whatsapp_sent?: boolean;
  whatsapp_url?: string;
  whatsapp_detail?: string;
}

export interface MessagesListResponse {
  inbox_unread: number;
  stats?: MessageListStats;
  messages: DirectMessage[];
}

export interface UserNotificationItem {
  id: number;
  user: number;
  sender: number | null;
  sender_name: string;
  platform: number | null;
  platform_name: string;
  event?: number | null;
  event_title?: string;
  kind?: string;
  kind_label?: string;
  icon?: string;
  action_path?: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  recipient_name?: string;
  recipient_email?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  today: number;
}

export interface NotificationsListResponse {
  notifications: UserNotificationItem[];
  stats: NotificationStats;
  platform_options: { value: string; label: string }[];
}

export interface MessagesInboxResponse {
  unread_count: number;
  direct_unread: number;
  guest_inbound_unread: number;
  messages: DirectMessage[];
  guest_messages: GuestMessageItem[];
}

export const commsAPI = {
  messagesInbox: () =>
    api.get<MessagesInboxResponse>("/platforms/comms/messages/inbox/"),
  messagesList: (box?: "inbox" | "outbox" | "all", filters?: MessageListFilters) =>
    api.get<MessagesListResponse>("/platforms/comms/messages/list/", {
      params: {
        ...(box ? { box } : {}),
        ...(filters?.is_read ? { is_read: filters.is_read } : {}),
        ...(filters?.delivery_status ? { delivery_status: filters.delivery_status } : {}),
        ...(filters?.opened ? { opened: filters.opened } : {}),
      },
    }),
  messageContacts: () =>
    api.get<{ contacts: MessageContact[] }>("/platforms/comms/messages/contacts/"),
  sendMessage: (data: {
    recipient_id: number;
    body: string;
    subject?: string;
    parent_id?: number;
  }) => api.post<DirectMessage>("/platforms/comms/messages/send/", data),
  markMessageRead: (id: number) =>
    api.post<DirectMessage>(`/platforms/comms/messages/${id}/read/`),
  deleteMessage: (id: number) =>
    api.delete(`/platforms/comms/messages/${id}/delete/`),
  guestMessagesList: (params?: { event?: number; guest?: number }) =>
    api.get<{ messages: GuestMessageItem[] }>("/platforms/comms/guest-messages/list/", {
      params: {
        ...(params?.event ? { event: params.event } : {}),
        ...(params?.guest ? { guest: params.guest } : {}),
      },
    }),
  guestMessagesContacts: (eventId?: number) =>
    api.get<{ contacts: GuestMessageContact[] }>(
      "/platforms/comms/guest-messages/contacts/",
      { params: eventId ? { event: eventId } : {} }
    ),
  sendGuestMessage: (data: {
    guest_id: number;
    content: string;
    via_whatsapp?: boolean;
  }) => api.post<GuestMessageItem>("/platforms/comms/guest-messages/send/", data),
  guestMessagesInbound: (params?: { event?: number; kind?: "greeting" | "inquiry" }) =>
    api.get<{ messages: GuestMessageItem[] }>(
      "/platforms/comms/guest-messages/inbound/",
      {
        params: {
          ...(params?.event ? { event: params.event } : {}),
          ...(params?.kind ? { kind: params.kind } : {}),
        },
      }
    ),
  markGuestMessagesRead: (ids: number[]) =>
    api.post<{ updated: number }>("/platforms/comms/guest-messages/mark-read/", { ids }),
  markAllGuestMessagesRead: () =>
    api.post<{ updated: number }>("/platforms/comms/guest-messages/mark-all-read/"),
  notificationsInbox: () =>
    api.get<{ unread_count: number; notifications: UserNotificationItem[] }>(
      "/platforms/comms/notifications/inbox/"
    ),
  notificationsList: (params?: Record<string, unknown>) =>
    api.get<NotificationsListResponse>("/platforms/comms/notifications/list/", { params }),
  deleteNotification: (id: number) =>
    api.delete(`/platforms/comms/notifications/${id}/delete/`),
  markNotificationsRead: (ids: number[]) =>
    api.post("/platforms/comms/notifications/mark-read/", { ids }),
  markAllNotificationsRead: () =>
    api.post("/platforms/comms/notifications/mark-all-read/"),
  deleteReadNotifications: () =>
    api.post("/platforms/comms/notifications/delete-read/"),
};

export interface PlatformKpis {
  activities_count: number;
  schedules_count: number;
  staff_count: number;
  guests_count: number;
  attendance_rate: number;
  confirmation_rate: number;
}

export interface RsvpChartData {
  labels: string[];
  confirmed: number[];
  declined: number[];
  invited: number[];
  confirmed_heights: string[];
  declined_heights: string[];
}

export interface PlatformActivity {
  id: number;
  title: string;
  organizer: string;
  guests: number;
  guests_total: number;
  confirmed_count: number;
  attended_count: number;
  declined_count: number;
  no_response_count: number;
  confirmation_rate: number;
  attendance_rate: number;
  absence_rate: number;
  completion_percent: number;
  phase_label: string;
  status: string;
  status_label: string;
  date: string;
  venue: string;
  cover_image: string;
  created_at: string;
}

export interface PlatformOverview {
  platform: Platform;
  kpis: PlatformKpis;
  recent_activities: PlatformActivity[];
  rsvp_charts: { monthly: RsvpChartData };
  staff_preview: PlatformStaffMember[];
}

export interface PlatformKpiCard {
  key: string;
  label: string;
  value: number;
  change_pct: number;
  icon: string;
  color: string;
  is_percent?: boolean;
}

export interface PlatformEventGrowth {
  yearly_growth_pct: number;
  monthly_growth_pct: number;
  year_events: number;
  progress_pct: number;
}

export interface PlatformMySettings {
  id: number;
  name: string;
  description: string;
  status: "active" | "blocked";
  status_label: string;
  owner_name: string;
  owner_email: string;
  logo_url: string;
  whatsapp_number: string;
  whatsapp_invites_enabled: boolean;
  whatsapp_link: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformMySettingsUpdate {
  name?: string;
  description?: string;
  whatsapp_number?: string;
  whatsapp_invites_enabled?: boolean;
  clear_logo?: boolean;
}

export interface PlatformMyOverview {
  platform: Platform;
  kpis: PlatformKpis;
  kpi_cards: PlatformKpiCard[];
  event_growth: PlatformEventGrowth;
  recent_activities: PlatformActivity[];
  rsvp_charts: { monthly: RsvpChartData };
  staff_preview: PlatformStaffMember[];
}

export interface EventManagerTeamMember {
  id: number;
  name: string;
  email: string;
  event_id: number;
  event_title: string;
  role_key: "event_organizer" | "coordinator" | "entry_manager";
  role_label: string;
  avatar_initial: string;
}

export interface EventManagerStaffRow {
  id: number;
  name: string;
  email: string;
  role_key: "coordinator" | "entry_manager";
  role_label: string;
  coordinator_label: string;
  perm_scan_qr: boolean;
  perm_edit_guests: boolean;
  perm_send_messages: boolean;
  account_status: string;
  is_active: boolean;
  avatar_initial: string;
  assigned_events: { id: number; title: string }[];
}

export interface EventManagerStaffTeamResponse {
  staff: EventManagerStaffRow[];
  stats: { total: number; coordinators: number; entry_managers: number };
  assignable_roles: { value: string; label: string }[];
  permission_options: { key: string; label: string }[];
  platform_events: { id: number; title: string }[];
}

export interface EventManagerStaffCreatePayload {
  email: string;
  first_name?: string;
  last_name?: string;
  role_key: "coordinator" | "entry_manager";
  coordinator_label?: string;
  password: string;
  perm_edit_guests?: boolean;
  perm_send_messages?: boolean;
}

export interface EventManagerTeamListResponse {
  team: EventManagerTeamMember[];
  stats: {
    total: number;
    organizers: number;
    coordinators: number;
  };
}

export interface ManagedEventRow {
  id: number;
  title: string;
  status: string;
  status_label: string;
  date: string;
  time: string;
  venue: string;
  guests_total: number;
  confirmed: number;
  attended: number;
  confirmation_rate: number;
  attendance_rate: number;
}

export interface EventManagerMyOverview {
  platform: Platform;
  membership: {
    id: number;
    member_role: string;
    role_label: string;
    perm_scan_qr: boolean;
    perm_edit_guests: boolean;
    perm_send_messages: boolean;
  };
  kpis: PlatformKpis;
  kpi_cards: PlatformKpiCard[];
  event_growth: PlatformEventGrowth;
  recent_activities: PlatformActivity[];
  rsvp_charts: { monthly: RsvpChartData };
  team_preview: EventManagerTeamMember[];
  event_stats: { total: number; active: number; completed: number };
}

export interface PlatformStaffMember {
  id: number;
  name: string;
  email: string;
  role: string;
  role_key: string;
  role_label: string;
  source?: string;
  avatar_initial: string;
  avatar_url?: string;
  joined_at: string;
  platform_id?: number;
  platform_name?: string;
  platform_member_id?: number | null;
  account_status?: "active" | "inactive" | "blocked";
  status_label?: string;
  events_count?: number;
  active_events_count?: number;
  completed_events_count?: number;
  coordinator_label?: string;
  perm_scan_qr?: boolean;
  perm_edit_guests?: boolean;
  perm_send_messages?: boolean;
}

export interface PlatformStaffStats {
  total: number;
  event_managers: number;
  event_organizers: number;
}

export interface PlatformStaffResponse {
  platform: Platform;
  staff: PlatformStaffMember[];
  stats: PlatformStaffStats;
  role_options: { value: string; label: string }[];
}

export interface AllPlatformStaffResponse {
  staff: PlatformStaffMember[];
  stats: PlatformStaffStats;
  role_options: { value: string; label: string }[];
  platform_options: { value: string; label: string }[];
}

export interface PlatformMemberPermissions {
  permissions: {
    perm_scan_qr: boolean;
    perm_edit_guests: boolean;
    perm_send_messages: boolean;
  };
  perm_scan_qr: boolean;
  perm_edit_guests: boolean;
  perm_send_messages: boolean;
}

export interface PlatformMyStaffResponse {
  platform: Platform;
  staff: PlatformStaffMember[];
  stats: PlatformStaffStats;
  assignable_roles: { value: string; label: string }[];
  filter_roles: { value: string; label: string }[];
  status_options: { value: string; label: string }[];
  permission_options: { key: string; label: string }[];
}

export interface PlatformTeamMemberDetail extends PlatformStaffMember {
  phone?: string;
  is_active?: boolean;
  first_name?: string;
  last_name?: string;
  participated_events?: PlatformEventParticipation[];
}

export interface PlatformEventParticipation {
  id: number;
  title: string;
  status: string;
  status_label: string;
  role_on_event: string;
  date: string;
}

export interface MemberActivityFilters {
  event_id?: number | string;
  date_from?: string;
  date_to?: string;
  time_from?: string;
  time_to?: string;
}

export interface MemberManagedEventFilters {
  status?: string;
  date_from?: string;
  date_to?: string;
}

export interface MemberMessageRow {
  id: number;
  guest_name: string;
  guest_id: number | null;
  event_id: number;
  event_title: string;
  created_at: string;
  date: string;
  time: string;
}

export interface MemberQrScanRow {
  id: number;
  guest_name: string;
  guest_id: number;
  event_id: number;
  event_title: string;
  scanned_at: string;
  date: string;
  time: string;
}

export interface MemberManagedEventRow {
  id: number;
  title: string;
  status: string;
  status_label: string;
  date: string;
  time: string;
  venue: string;
  guests_total: number;
  invited: number;
  confirmed: number;
  attended: number;
  declined: number;
  cancelled: number;
  responded: number;
  confirmation_rate: number;
  absence_count: number;
  absence_rate: number;
  attendance_rate: number;
}

export interface PlatformMemberProfileSections {
  show_messages: boolean;
  show_qr_scans: boolean;
  show_managed_events: boolean;
}

export interface PlatformMemberProfileResponse {
  member: PlatformTeamMemberDetail;
  event_stats: { total: number; active: number; completed: number };
  sections: PlatformMemberProfileSections;
  messages_total: number;
  messages_preview: MemberMessageRow[];
  qr_scans_total: number;
  qr_scans_preview: MemberQrScanRow[];
  managed_events_total: number;
  managed_events_preview: MemberManagedEventRow[];
  event_options: { id: number; title: string }[];
  status_options: { value: string; label: string }[];
}

export interface PlatformMemberMessagesResponse {
  total: number;
  messages: MemberMessageRow[];
}

export interface PlatformMemberQrScansResponse {
  total: number;
  qr_scans: MemberQrScanRow[];
}

export interface PlatformMemberManagedEventsResponse {
  total: number;
  events: MemberManagedEventRow[];
}

export interface PlatformEventStats {
  total: number;
  completed: number;
  active_now: number;
  scheduled: number;
  draft: number;
}

export interface PlatformEventCard {
  id: number;
  title: string;
  owner_name: string;
  venue: string;
  geo_address: string;
  location: string;
  status: string;
  status_label: string;
  date: string;
  time: string;
  cover_image: string;
  guests_count: number;
  attended_count: number;
  confirmed_count: number;
  confirmation_rate: number;
  attendance_rate: number;
  absence_rate: number;
  completion_percent: number;
  phase: string;
  phase_label: string;
  created_at: string;
}

export interface PlatformEventRow extends PlatformEventCard {
  event_manager: string;
  event_organizer: string;
  coordinators: string;
}

export interface PlatformMyEventsResponse {
  platform: { id: number; name: string };
  stats: PlatformEventStats;
  top_attendance: PlatformEventCard[];
  bottom_attendance: PlatformEventCard[];
  /** مناسبات نشطة الآن — لوحة مدير الفعالية */
  active_now?: PlatformEventCard[];
  /** آخر المناسبات — لوحة مدير الفعالية */
  recent_events?: PlatformEventCard[];
  events: PlatformEventRow[];
  status_options: { value: string; label: string }[];
  phase_options: { value: string; label: string }[];
}

export interface MemberSectionRow {
  id: number;
  name: string;
  description: string;
  location: string;
  color: string;
  order: number;
  created_at: string;
  event_id: number;
  event_title: string;
  event_status: string;
  event_status_label: string;
  groups_count: number;
  guests_count: number;
  guests_confirmed: number;
  confirmation_rate: number;
  attendance_rate: number;
  status: string;
  status_label: string;
}

export interface MemberSectionsDashboard {
  sections: MemberSectionRow[];
  events: { id: number; title: string; status: string; status_label: string }[];
  event_status_options: { value: string; label: string }[];
  section_status_options: { value: string; label: string }[];
}

export interface EventBrief {
  id: number;
  title: string;
  platform_id: number | null;
  platform_name: string;
  manager_name: string;
  status: string;
  status_label: string;
  guests_count: number;
  attended_count: number;
  confirmed_count: number;
  date: string;
  venue: string;
  cover_image: string;
  created_at: string;
}

export interface EventStats {
  total: number;
  completed: number;
  cancelled: number;
  active: number;
  archived: number;
  draft: number;
  confirmation_rate: number;
  non_confirmation_rate: number;
}

export interface EventChartSeries {
  labels: string[];
  values: number[];
  heights: string[];
}

export interface ActivityHeatmapData {
  day_labels: string[];
  hour_labels: string[];
  matrix: number[][];
  max: number;
}

export interface EventsOverview {
  stats: EventStats;
  latest: EventBrief[];
  top_attendance: EventBrief[];
  charts: {
    weekday: EventChartSeries;
    monthly: EventChartSeries;
    growth: EventChartSeries;
    peak: ActivityHeatmapData;
  };
}

export interface EventDetail {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  end_date: string | null;
  end_time: string | null;
  venue: string;
  geo_address: string;
  latitude: number | null;
  longitude: number | null;
  location: string;
  status: string;
  status_label: string;
  max_guests: number;
  cover_image: string;
  created_by: number;
  created_by_name: string;
  owner_name: string;
  event_manager: string;
  event_organizer: string;
  managers: number[];
  sections: EventSectionDetail[];
  schedules: EventScheduleItem[];
  groups: EventGroupItem[];
  stats: EventGuestStats;
  completion_percent: number;
  phase: string;
  phase_label: string;
  recent_activity: EventActivityItem[];
  guest_greetings?: EventGuestGreeting[];
  started_at: string | null;
  ended_at: string | null;
  can_start: boolean;
  can_end: boolean;
  live_elapsed_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface EventGuestGreeting {
  id: number;
  guest_name: string;
  content: string;
  created_at: string;
}

export interface EventGroupItem {
  id: number;
  name: string;
  description: string;
  location?: string;
  color: string;
}

export interface EventSectionGroupItem extends EventGroupItem {
  guests_count: number;
  guests_confirmed: number;
  location?: string;
}

export interface EventSectionDetail {
  id: number;
  name: string;
  description: string;
  location: string;
  color: string;
  order: number;
  guests_count: number;
  guests_confirmed: number;
  groups: EventSectionGroupItem[];
}

export interface EventScheduleItem {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  order: number;
}

export interface EventGuestStats {
  guests_total: number;
  invited: number;
  confirmed: number;
  attended: number;
  seated: number;
  declined: number;
  cancelled: number;
  responded: number;
  no_response: number;
  confirmation_rate: number;
  absence_count: number;
  absence_rate: number;
  attendance_rate: number;
}

export interface EventActivityItem {
  id: string;
  message: string;
  at: string;
  tone: "primary" | "tertiary" | "error";
}

export interface EventGuestRow {
  id: number;
  event: number;
  event_title: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  status_label: string;
  section: number | null;
  section_name: string;
  group: number | null;
  group_name: string;
  created_at: string;
}

export interface GuestListStats {
  total: number;
  pending: number;
  invited: number;
  confirmed: number;
  attended: number;
  seated: number;
  declined: number;
  cancelled: number;
  responded: number;
  confirmation_rate: number;
  attendance_rate: number;
}

export interface EventGuestDetail extends EventGuestRow {
  notes: string;
  dietary_requirements: string;
  greeting: string;
  qr_code: string;
  user: number | null;
}

export interface EventGroupOverviewItem {
  id: number;
  name: string;
  description: string;
  color: string;
  section_id: number | null;
  section_name: string;
  section_color: string;
  guests_total: number;
  guests_confirmed: number;
  guests_attended: number;
  guests_declined: number;
  guests_pending: number;
  confirmation_rate: number;
}

export interface EventGroupsOverviewResponse {
  event: {
    id: number;
    title: string;
    status: string;
    status_label: string;
  };
  stats: {
    groups_total: number;
    sections_total: number;
    guests_total: number;
    confirmed_total: number;
    pending_total: number;
    declined_total: number;
    attended_total: number;
  };
  sections: { id: number; name: string; color: string; order: number }[];
  groups: EventGroupOverviewItem[];
}

export interface EventTableSeat {
  id: number;
  guest: number | null;
  guest_name: string;
  seat_number: number;
}

export interface EventTableRow {
  id: number;
  event: number;
  plan?: number | null;
  plan_name?: string;
  section: number | null;
  section_name?: string;
  group: number | null;
  group_name?: string;
  name: string;
  capacity: number;
  shape: string;
  position_x: number;
  position_y: number;
  seats: EventTableSeat[];
  occupied_seats: number;
}

export interface EventSeatingSeat {
  id: number | null;
  seat_number: number;
  guest_id: number | null;
  guest_name: string;
  initials: string;
  occupied: boolean;
  is_vip: boolean;
  section_name: string;
  group_name: string;
  pos_x: number | null;
  pos_y: number | null;
}

export interface EventSeatingTable {
  id: number;
  name: string;
  shape: string;
  capacity: number;
  position_x: number;
  position_y: number;
  section_id: number | null;
  section_name: string;
  section_color: string;
  group_id: number | null;
  group_name: string;
  group_color: string;
  occupied_seats: number;
  status_label: string;
  seat_positions?: Record<string, { x: number; y: number }>;
  seats: EventSeatingSeat[];
}

export interface EventSeatingPlan {
  id: number;
  name: string;
  description: string;
  order: number;
  tables: EventSeatingTable[];
}

export interface EventSeatingUnassignedGuest {
  id: number;
  full_name: string;
  section_id: number | null;
  section_name: string;
  group_id: number | null;
  group_name: string;
  initials: string;
  is_vip: boolean;
}

export interface EventSeatingOverviewResponse {
  event: { id: number; title: string };
  stats: {
    total_guests: number;
    assigned_guests: number;
    unassigned_guests: number;
    total_tables: number;
    total_seats: number;
    occupied_seats: number;
    occupancy_rate: number;
  };
  unassigned_guests: EventSeatingUnassignedGuest[];
  plans: EventSeatingPlan[];
}

/** استخراج قائمة من استجابة DRF المُصفّاة أو مصفوفة خام */
export function extractApiList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) {
    return (data as { results?: T[] }).results ?? [];
  }
  return [];
}

export interface EventListItem {
  id: number;
  title: string;
  date: string;
  time: string;
  venue: string;
  geo_address?: string;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  status_label: string;
  max_guests: number;
  cover_image?: string;
  guests_count: number;
  attended_count: number;
  confirmed_count: number;
  platform_id: number | null;
  platform_name: string;
  manager_name: string;
  created_at: string;
}

export interface SystemOverview {
  kpis: PlatformKpis;
  recent_activities: PlatformActivity[];
  rsvp_charts: { monthly: RsvpChartData };
}

export interface MonitoringService {
  id: string;
  name: string;
  status: "healthy" | "warning" | "error";
  detail: string;
  latency_ms: number;
}

export interface SystemMonitoringData {
  timestamp: string;
  server: {
    hostname: string;
    os: string;
    python_version: string;
    django_version: string;
    cpu_count: number;
  };
  cpu: { percent: number; per_core: number[] };
  memory: {
    used_gb: number;
    total_gb: number;
    percent: number;
    available_gb?: number;
  };
  disk: {
    used_gb: number;
    total_gb: number;
    percent: number;
    free_gb?: number;
  };
  network: { bytes_sent_mb: number; bytes_recv_mb: number };
  uptime_seconds: number;
  load_avg: number[] | null;
  database: { status: string; vendor: string; latency_ms: number };
  business: { platforms: number; events: number; users: number; guests: number };
  services: MonitoringService[];
  psutil_available: boolean;
}

export const monitoringAPI = {
  overview: () => api.get<SystemMonitoringData>("/monitoring/overview/"),
};

export interface IntegrationStats {
  total: number;
  active: number;
  inactive: number;
  tested_ok: number;
  test_failed: number;
  never_tested: number;
  by_category: Record<
    string,
    { label: string; count: number; active: number }
  >;
}

export interface IntegrationProviderOption {
  value: string;
  label: string;
  category: string;
  category_label: string;
  icon: string;
  color: string;
  fields: string[];
  help: string;
}

export interface IntegrationCredential {
  id: number;
  provider: string;
  provider_label: string;
  category: string;
  category_label: string;
  name: string;
  description: string;
  environment: "sandbox" | "production";
  environment_label: string;
  is_active: boolean;
  is_primary: boolean;
  phone_number_id: string;
  business_account_id: string;
  from_email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: number | null;
  smtp_use_tls: boolean;
  webhook_url: string;
  config: Record<string, unknown>;
  notes: string;
  last_tested_at: string | null;
  last_test_status: "never" | "success" | "failed";
  last_test_status_label: string;
  last_test_error: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  api_key_masked: string;
  api_secret_masked: string;
  access_token_masked: string;
  refresh_token_masked: string;
  webhook_secret_masked: string;
  has_api_key: boolean;
  has_api_secret: boolean;
  icon: string;
  color: string;
}

export interface IntegrationOverview {
  stats: IntegrationStats;
  providers: IntegrationProviderOption[];
  categories: { value: string; label: string }[];
}

export interface IntegrationWritePayload {
  provider: string;
  category?: string;
  name: string;
  description?: string;
  environment?: string;
  is_active?: boolean;
  is_primary?: boolean;
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  refresh_token?: string;
  phone_number_id?: string;
  business_account_id?: string;
  from_email?: string;
  from_name?: string;
  smtp_host?: string;
  smtp_port?: number | null;
  smtp_use_tls?: boolean;
  webhook_url?: string;
  webhook_secret?: string;
  config?: Record<string, unknown>;
  notes?: string;
}

export const integrationsAPI = {
  overview: () => api.get<IntegrationOverview>("/integrations/credentials/overview/"),
  list: (params?: Record<string, unknown>) =>
    api.get<IntegrationCredential[] | { results: IntegrationCredential[] }>(
      "/integrations/credentials/",
      { params }
    ),
  get: (id: number) => api.get<IntegrationCredential>(`/integrations/credentials/${id}/`),
  create: (data: IntegrationWritePayload) =>
    api.post<IntegrationCredential>("/integrations/credentials/", data),
  update: (id: number, data: Partial<IntegrationWritePayload>) =>
    api.patch<IntegrationCredential>(`/integrations/credentials/${id}/`, data),
  delete: (id: number) => api.delete(`/integrations/credentials/${id}/`),
  test: (id: number) =>
    api.post<{ success: boolean; message: string; credential: IntegrationCredential }>(
      `/integrations/credentials/${id}/test/`
    ),
  toggle: (id: number) => api.post<IntegrationCredential>(`/integrations/credentials/${id}/toggle/`),
  setPrimary: (id: number) =>
    api.post<IntegrationCredential>(`/integrations/credentials/${id}/set_primary/`),
};

export interface ExternalLinkStats {
  total: number;
  active: number;
  inactive: number;
  featured: number;
  system_wide: number;
  platform_specific: number;
  total_clicks: number;
  by_category: Record<string, { label: string; count: number; active: number }>;
  by_placement: Record<string, { label: string; count: number }>;
}

export interface ExternalLinkTypeOption {
  value: string;
  label: string;
  category: string;
  category_label: string;
  icon: string;
  color: string;
}

export interface ExternalLink {
  id: number;
  title: string;
  url: string;
  link_type: string;
  link_type_label: string;
  category: string;
  category_label: string;
  placement: string;
  placement_label: string;
  description: string;
  icon: string;
  display_icon: string;
  display_color: string;
  domain: string;
  platform: number | null;
  platform_name: string;
  is_active: boolean;
  is_featured: boolean;
  open_in_new_tab: boolean;
  sort_order: number;
  click_count: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalLinksOverview {
  stats: ExternalLinkStats;
  link_types: ExternalLinkTypeOption[];
  categories: { value: string; label: string }[];
  placements: { value: string; label: string }[];
  platform_options: { id: number; name: string }[];
}

export interface ExternalLinkWritePayload {
  title: string;
  url: string;
  link_type?: string;
  category?: string;
  placement?: string;
  description?: string;
  icon?: string;
  platform?: number | null;
  is_active?: boolean;
  is_featured?: boolean;
  open_in_new_tab?: boolean;
  sort_order?: number;
}

export const externalLinksAPI = {
  overview: () => api.get<ExternalLinksOverview>("/external-links/links/overview/"),
  list: (params?: Record<string, unknown>) =>
    api.get<ExternalLink[] | { results: ExternalLink[] }>("/external-links/links/", { params }),
  get: (id: number) => api.get<ExternalLink>(`/external-links/links/${id}/`),
  create: (data: ExternalLinkWritePayload) =>
    api.post<ExternalLink>("/external-links/links/", data),
  update: (id: number, data: Partial<ExternalLinkWritePayload>) =>
    api.patch<ExternalLink>(`/external-links/links/${id}/`, data),
  delete: (id: number) => api.delete(`/external-links/links/${id}/`),
  toggle: (id: number) => api.post<ExternalLink>(`/external-links/links/${id}/toggle/`),
  toggleFeatured: (id: number) =>
    api.post<ExternalLink>(`/external-links/links/${id}/toggle_featured/`),
  validateUrl: (url: string) =>
    api.post<{ valid: boolean; message: string }>("/external-links/links/validate_url/", { url }),
  reorder: (items: { id: number; sort_order: number }[]) =>
    api.post<ExternalLink[]>("/external-links/links/reorder/", { items }),
};

export interface StaticPageStats {
  total: number;
  published: number;
  draft: number;
  in_footer: number;
  on_landing: number;
  by_type: Record<string, { label: string; count: number; published: number }>;
}

export interface StaticPageTypeOption {
  value: string;
  label: string;
  slug: string;
  icon: string;
  color: string;
  has_template: boolean;
}

export interface StaticPage {
  id: number;
  slug: string;
  page_type: string;
  page_type_label: string;
  title: string;
  subtitle: string;
  content: string;
  meta_title: string;
  meta_description: string;
  icon: string;
  display_icon: string;
  display_color: string;
  is_published: boolean;
  show_in_footer: boolean;
  show_in_header: boolean;
  show_on_landing: boolean;
  sort_order: number;
  published_at: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  public_url: string;
  word_count: number;
}

export interface StaticPagesOverview {
  stats: StaticPageStats;
  page_types: StaticPageTypeOption[];
}

export interface StaticPageWritePayload {
  slug?: string;
  page_type?: string;
  title: string;
  subtitle?: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
  icon?: string;
  is_published?: boolean;
  show_in_footer?: boolean;
  show_in_header?: boolean;
  show_on_landing?: boolean;
  sort_order?: number;
}

export interface PublicStaticPageListItem {
  slug: string;
  title: string;
  subtitle: string;
  page_type: string;
  display_icon: string;
  show_in_footer: boolean;
  show_in_header: boolean;
  show_on_landing: boolean;
  sort_order: number;
}

export interface PublicStaticPage extends PublicStaticPageListItem {
  page_type_label: string;
  content: string;
  meta_title: string;
  meta_description: string;
  icon: string;
  published_at: string | null;
  updated_at: string;
}

export const staticPagesAPI = {
  overview: () => api.get<StaticPagesOverview>("/static-pages/pages/overview/"),
  list: (params?: Record<string, unknown>) =>
    api.get<StaticPage[] | { results: StaticPage[] }>("/static-pages/pages/", { params }),
  get: (id: number) => api.get<StaticPage>(`/static-pages/pages/${id}/`),
  create: (data: StaticPageWritePayload) => api.post<StaticPage>("/static-pages/pages/", data),
  update: (id: number, data: Partial<StaticPageWritePayload>) =>
    api.patch<StaticPage>(`/static-pages/pages/${id}/`, data),
  delete: (id: number) => api.delete(`/static-pages/pages/${id}/`),
  publish: (id: number) => api.post<StaticPage>(`/static-pages/pages/${id}/publish/`),
  unpublish: (id: number) => api.post<StaticPage>(`/static-pages/pages/${id}/unpublish/`),
  seedDefaults: () =>
    api.post<{ created: number; updated: number }>("/static-pages/pages/seed_defaults/"),
  seedTemplate: (page_type: string) =>
    api.post<StaticPage>("/static-pages/pages/seed_template/", { page_type }),
  reorder: (items: { id: number; sort_order: number }[]) =>
    api.post<StaticPage[]>("/static-pages/pages/reorder/", { items }),
};

export const publicContentAPI = {
  landing: () =>
    api.get<{
      landing_pages: PublicStaticPageListItem[];
      footer_pages: PublicStaticPageListItem[];
    }>("/static-pages/public/landing/"),
  listPages: (placement?: string) =>
    api.get<PublicStaticPageListItem[]>("/static-pages/public/pages/", {
      params: placement ? { placement } : undefined,
    }),
  getPage: (slug: string) =>
    api.get<PublicStaticPage>(`/static-pages/public/pages/${slug}/`),
};

export interface LandingStatItem {
  label: string;
  value: string;
  icon: string;
}

export interface LandingFeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface LandingTestimonial {
  name: string;
  role: string;
  text: string;
  source?: string;
}

export interface PublicFAQItem {
  id: number;
  question: string;
  answer: string;
  sort_order?: number;
}

export interface TestimonialSubmission {
  id: number;
  name: string;
  role: string;
  text: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  status_label: string;
  show_on_landing: boolean;
  source: string;
  source_label: string;
  created_at: string;
  updated_at: string;
}

export interface FAQAdminItem {
  id: number;
  question: string;
  answer: string;
  asker_name: string;
  asker_email: string;
  status: "pending" | "answered" | "closed";
  status_label: string;
  is_published: boolean;
  sort_order: number;
  answered_by_name?: string;
  created_at: string;
  updated_at: string;
  answered_at?: string;
}

export interface LandingSiteConfig {
  hero_title: string;
  hero_subtitle: string;
  hero_description: string;
  hero_cta_primary: string;
  hero_cta_primary_url: string;
  hero_cta_secondary: string;
  hero_cta_secondary_url: string;
  stats: LandingStatItem[];
  features: LandingFeatureItem[];
  testimonials: LandingTestimonial[];
  partners_title: string;
  gallery_title: string;
  video_section_title: string;
  contact_email: string;
  contact_phone: string;
  meta_title: string;
  meta_description: string;
  is_published?: boolean;
  updated_at?: string;
}

export interface PublicMediaItem {
  id: number;
  title: string;
  description: string;
  alt_text: string;
  media_type: "image" | "video_url" | "video_file";
  media_type_label: string;
  section: string;
  section_label: string;
  file_url: string;
  video_url: string;
  thumbnail_url: string;
  embed_url: string;
  sort_order: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicSitePayload {
  published: boolean;
  message?: string;
  config?: LandingSiteConfig;
  media?: Record<string, PublicMediaItem[]>;
  media_all?: PublicMediaItem[];
  static_pages?: PublicStaticPageListItem[];
  external_links?: { title: string; url: string; icon: string; link_type: string }[];
  footer_pages?: PublicStaticPageListItem[];
  header_pages?: PublicStaticPageListItem[];
  faq?: PublicFAQItem[];
  announcement_banners?: AnnouncementPublicItem[];
  announcement_videos?: AnnouncementPublicItem[];
  admin_whatsapp_url?: string;
}

export interface AnnouncementPublicItem {
  id: number;
  title: string;
  description: string;
  section: "banner" | "video";
  media_type: string;
  image_url: string;
  video_url: string;
  video_file_url: string;
  embed_url: string;
  link_url: string;
  display_duration: number;
  sort_order: number;
}

export interface AnnouncementItem extends AnnouncementPublicItem {
  section_label: string;
  media_type_label: string;
  is_active: boolean;
  show_on_landing: boolean;
  starts_at: string | null;
  ends_at: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementsOverview {
  stats: { total: number; active: number; banners: number; videos: number; on_landing: number };
  sections: { value: string; label: string }[];
  media_types: { value: string; label: string }[];
}

export interface PublicMediaOverview {
  config: LandingSiteConfig;
  media: PublicMediaItem[];
  stats: { total_media: number; active_media: number; images: number; videos: number };
  sections: { value: string; label: string }[];
  media_types: { value: string; label: string }[];
}

export const publicMediaAPI = {
  overview: () => api.get<PublicMediaOverview>("/public-media/overview/"),
  getConfig: () => api.get<LandingSiteConfig>("/public-media/config/"),
  updateConfig: (data: Partial<LandingSiteConfig>) =>
    api.patch<LandingSiteConfig>("/public-media/config/", data),
  seed: () => api.post<LandingSiteConfig>("/public-media/seed/"),
  listItems: (params?: Record<string, unknown>) =>
    api.get<PublicMediaItem[]>("/public-media/items/", { params }),
  createItem: (formData: FormData) =>
    api.post<PublicMediaItem>("/public-media/items/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateItem: (id: number, formData: FormData) =>
    api.patch<PublicMediaItem>(`/public-media/items/${id}/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteItem: (id: number) => api.delete(`/public-media/items/${id}/`),
  publicSite: () => api.get<PublicSitePayload>("/public-media/public/site/"),
  listTestimonials: () => api.get<TestimonialSubmission[]>("/public-media/testimonials/"),
  updateTestimonial: (id: number, data: Partial<TestimonialSubmission>) =>
    api.patch<TestimonialSubmission>(`/public-media/testimonials/${id}/`, data),
  submitTestimonial: (data: { name: string; role?: string; text: string; email?: string }) =>
    api.post<{ id: number; message: string }>("/public-media/public/testimonials/submit/", data),
};

export const faqAPI = {
  overview: () =>
    api.get<{ stats: { total: number; pending: number; answered: number; published: number } }>(
      "/faq/overview/"
    ),
  list: () => api.get<FAQAdminItem[]>("/faq/items/"),
  create: (data: Partial<FAQAdminItem>) => api.post<FAQAdminItem>("/faq/items/", data),
  update: (id: number, data: Partial<FAQAdminItem>) =>
    api.patch<FAQAdminItem>(`/faq/items/${id}/`, data),
  delete: (id: number) => api.delete(`/faq/items/${id}/`),
  submitQuestion: (data: { question: string; asker_name?: string; asker_email?: string }) =>
    api.post<{ id: number; message: string }>("/faq/public/submit/", data),
  publicList: () => api.get<PublicFAQItem[]>("/faq/public/list/"),
};

export const announcementsAPI = {
  overview: () => api.get<AnnouncementsOverview>("/announcements/overview/"),
  list: (params?: Record<string, unknown>) =>
    api.get<AnnouncementItem[]>("/announcements/items/", { params }),
  create: (formData: FormData) =>
    api.post<AnnouncementItem>("/announcements/items/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id: number, formData: FormData) =>
    api.patch<AnnouncementItem>(`/announcements/items/${id}/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id: number) => api.delete(`/announcements/items/${id}/`),
  publicList: () =>
    api.get<{ banners: AnnouncementPublicItem[]; videos: AnnouncementPublicItem[] }>(
      "/announcements/public/list/"
    ),
};

export interface ActivityLogItem {
  id: number;
  user: number | null;
  user_email: string;
  user_name: string;
  user_role: string;
  action: string;
  action_label: string;
  category: string;
  category_label: string;
  status: string;
  status_label: string;
  object_type: string;
  object_id: string;
  object_repr: string;
  description: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string;
  request_path: string;
  request_method: string;
  platform_id: number | null;
  created_at: string;
}

export interface ActivityLogsOverview {
  stats: {
    total: number;
    today: number;
    last_7_days: number;
    failures_today: number;
    success_rate: number;
  };
  by_category: { category: string; label: string; count: number }[];
  by_action: { action: string; label: string; count: number }[];
  by_status: { status: string; label: string; count: number }[];
  recent: ActivityLogItem[];
  filters: {
    actions: { value: string; label: string }[];
    categories: { value: string; label: string }[];
    statuses: { value: string; label: string }[];
  };
}

export interface PaginatedActivityLogs {
  count: number;
  next: string | null;
  previous: string | null;
  results: ActivityLogItem[];
}

export const activityLogsAPI = {
  overview: () => api.get<ActivityLogsOverview>("/activity-logs/overview/"),
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedActivityLogs>("/activity-logs/logs/", { params }),
};

export interface SystemSettingsChoice {
  value: string;
  label: string;
}

export interface SystemSettings {
  platform_name: string;
  logo_url: string;
  default_language: string;
  default_language_label: string;
  timezone: string;
  timezone_label: string;
  theme_primary: string;
  notify_email: boolean;
  notify_sms: boolean;
  notify_whatsapp: boolean;
  notify_push: boolean;
  notify_system_alerts: boolean;
  qr_validity: string;
  qr_validity_label: string;
  rsvp_auto_enabled: boolean;
  high_res_headers_only: boolean;
  ticket_format: string;
  ticket_format_label: string;
  updated_at: string;
  choices?: {
    languages: SystemSettingsChoice[];
    timezones: SystemSettingsChoice[];
    qr_validity: SystemSettingsChoice[];
    ticket_formats: SystemSettingsChoice[];
  };
}

export const systemSettingsAPI = {
  get: () => api.get<SystemSettings>("/system-settings/"),
  update: (data: Record<string, unknown> | FormData) => {
    if (data instanceof FormData) {
      return api.patch<SystemSettings>("/system-settings/", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return api.patch<SystemSettings>("/system-settings/", data);
  },
};

export interface ReportKpi {
  label: string;
  value: string | number;
}

export interface ReportChart {
  id: string;
  title: string;
  type: "bar" | "rsvp" | "heatmap";
  data: EventChartSeries | RsvpChartData | ActivityHeatmapData;
  color?: "primary" | "tertiary";
}

export interface ReportTable {
  headers: string[];
  rows: (string | number)[][];
}

export interface ReportSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  implemented: boolean;
  kpis: ReportKpi[];
  charts: ReportChart[];
  table: ReportTable | null;
}

export interface GrowthSummaryItem {
  label: string;
  current: number;
  previous: number;
  growth: number;
}

export interface ReportSuggestion {
  icon: string;
  title: string;
  body: string;
  priority: "high" | "medium" | "low";
}

export interface ReportsDashboardData {
  generated_at: string;
  platform_name?: string;
  scope?: "system" | "platform";
  overview_kpis: Array<{
    key: string;
    label: string;
    value: string | number;
    icon: string;
    color: string;
  }>;
  growth_summary: GrowthSummaryItem[];
  sections: ReportSection[];
  suggestions: ReportSuggestion[];
  recent_activities: PlatformActivity[];
  rsvp_charts: { monthly: RsvpChartData };
}

export const reportsAPI = {
  dashboard: () => api.get<ReportsDashboardData>("/reports/dashboard/"),
};
