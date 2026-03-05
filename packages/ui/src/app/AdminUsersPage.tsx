import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, DataTable, Dialog, EmptyState, PageHeader, TabBar, TextField, Toolbar } from "@nimbus/ui-kit";
import { ApiError } from "../api/errors";
import { createAdminUsersApi, type AdminUser, type Invite } from "../api/adminUsers";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import "./AdminUsersPage.css";

const DAY_SECONDS = 60 * 60 * 24;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}


function inviteStatus(invite: Invite): "pending" | "expired" {
  if (invite.used_at) return "expired";
  const expiresAt = invite.expires_at ? new Date(invite.expires_at).getTime() : NaN;
  if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) return "expired";
  return "pending";
}

const statusTextKey: Record<"active" | "inactive" | "pending" | "expired", I18nKey> = {
  active: "status.active",
  inactive: "admin.users.status.inactive",
  pending: "admin.users.status.pending",
  expired: "admin.users.status.expired",
};

type UserRow = {
  id: string;
  username: string;
  email: string;
  lastActive: string;
  status: "active" | "inactive";
};

type InviteRow = {
  id: string;
  token: string;
  invitedBy: string;
  invitedAt: string;
  status: "pending" | "expired";
};


function mapUserRow(user: AdminUser): UserRow {
  return {
    id: user.id,
    username: user.username,
    email: "-",
    lastActive: formatDate(user.last_login_at),
    status: user.role === "ADMIN" ? "active" : "inactive",
  };
}

export default function AdminUsersPage() {
  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const adminUsersApi = useMemo(() => createAdminUsersApi(apiClient), [apiClient]);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"users" | "invites">("users");
  const [loading, setLoading] = useState(true);
  const [loadErrorKey, setLoadErrorKey] = useState<I18nKey | null>(null);

  const [isInviteOpen, setInviteOpen] = useState(false);
  const [isCreatingInvite, setCreatingInvite] = useState(false);
  const [inviteErrorKey, setInviteErrorKey] = useState<I18nKey | null>(null);
  const [inviteExpiryDays, setInviteExpiryDays] = useState("7");
  const [createdToken, setCreatedToken] = useState("");

  const queryValue = normalize(query);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadErrorKey(null);

    try {
      const response = await adminUsersApi.listUsers();
      setUsers(response.items.map(mapUserRow));
    } catch (error) {
      setLoadErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setLoading(false);
    }
  }, [adminUsersApi]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!isInviteOpen) {
      setInviteErrorKey(null);
      setInviteExpiryDays("7");
      setCreatedToken("");
      setCreatingInvite(false);
    }
  }, [isInviteOpen]);

  const visibleUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          normalize(user.username).includes(queryValue) || normalize(user.email).includes(queryValue),
      ),
    [queryValue, users],
  );

  const visibleInvites = useMemo(
    () =>
      invites.filter(
        (invite) =>
          normalize(invite.token).includes(queryValue) || normalize(invite.invitedBy).includes(queryValue),
      ),
    [queryValue, invites],
  );

  const usersColumns = useMemo(
    () => [
      {
        id: "username",
        header: t("field.username"),
        renderCell: (item: UserRow) => item.username,
      },
      {
        id: "email",
        header: t("field.email"),
        renderCell: (item: UserRow) => item.email,
      },
      {
        id: "lastActive",
        header: t("field.modifiedAt"),
        renderCell: (item: UserRow) => item.lastActive,
      },
      {
        id: "status",
        header: t("field.status"),
        renderCell: (item: UserRow) => t(statusTextKey[item.status]),
      },
    ],
    [],
  );

  const inviteColumns = useMemo(
    () => [
      {
        id: "token",
        header: t("admin.users.inviteToken"),
        renderCell: (item: InviteRow) => item.token,
      },
      {
        id: "invitedBy",
        header: t("admin.users.invitedBy"),
        renderCell: (item: InviteRow) => item.invitedBy,
      },
      {
        id: "invitedAt",
        header: t("admin.users.invitedAt"),
        renderCell: (item: InviteRow) => item.invitedAt,
      },
      {
        id: "status",
        header: t("field.status"),
        renderCell: (item: InviteRow) => t(statusTextKey[item.status]),
      },
    ],
    [],
  );

  const tabs = useMemo(
    () => [
      { id: "users", label: `${t("admin.users.tab.users")} (${users.length})` },
      { id: "invites", label: `${t("admin.users.tab.invites")} (${invites.length})` },
    ],
    [invites.length, users.length],
  );

  const handleOpenInvite = () => {
    setInviteOpen(true);
  };

  const handleCreateInvite = async (event?: React.FormEvent) => {
    event?.preventDefault();

    const parsedDays = Number.parseInt(inviteExpiryDays, 10);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      setInviteErrorKey("err.validation");
      return;
    }

    setCreatingInvite(true);
    setInviteErrorKey(null);
    setCreatedToken("");

    try {
      const created = await adminUsersApi.createInvite({
        expires_in_seconds: parsedDays * DAY_SECONDS,
        role: "USER",
        locale: "ko-KR",
      });
      const tokenValue = created.token ?? "";
      setCreatedToken(tokenValue);
      const row: InviteRow = {
        id: created.id,
        token: tokenValue,
        invitedBy: t("admin.users.title"),
        invitedAt: formatDate(created.created_at),
        status: inviteStatus(created),
      };
      setInvites((current) => [row, ...current]);
      await loadUsers();
    } catch (error) {
      setInviteErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setCreatingInvite(false);
    }
  };

  const isInviteBusy = isCreatingInvite;
  const listState = tab === "users" ? visibleUsers : visibleInvites;

  return (
    <section className="admin-users">
      <PageHeader
        title={t("admin.users.title")}
        actions={
          <Toolbar>
            <Button variant="primary" onClick={handleOpenInvite} disabled={loading}>
              {t("admin.users.inviteAction")}
            </Button>
            <Button variant="ghost" onClick={() => setQuery("") }>
              {t("admin.users.clearAction")}
            </Button>
          </Toolbar>
        }
      />

      <div className="admin-users__panel">
        <TextField
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={t("field.search")}
          autoComplete="off"
        />
        <TabBar
          tabs={tabs}
          activeId={tab}
          onChange={(id) => setTab(id === "invites" ? "invites" : "users")}
        />
      </div>

      {loadErrorKey ? <div className="admin-users__error">{t(loadErrorKey)}</div> : null}

      {loading ? (
        <EmptyState title={t("msg.loading")} detail={t("admin.users.loadingDetail")} />
      ) : listState.length === 0 ? (
        <EmptyState title={t("admin.users.emptyTitle")} detail={t("admin.users.emptyDetail")} />
      ) : tab === "users" ? (
        <DataTable<UserRow>
          items={visibleUsers}
          columns={usersColumns}
          heightPx={260}
          rowHeightPx={52}
          getRowKey={(item) => item.id}
        />
      ) : (
        <DataTable<InviteRow>
          items={visibleInvites}
          columns={inviteColumns}
          heightPx={260}
          rowHeightPx={52}
          getRowKey={(item) => item.id}
        />
      )}

      <Dialog
        open={isInviteOpen}
        title={t("admin.users.inviteDialogTitle")}
        onClose={() => setInviteOpen(false)}
        closeLabel={t("action.close")}
        footer={
          <div className="nd-dialog__actions">
            <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={isInviteBusy}>
              {t("action.close")}
            </Button>
            <Button onClick={handleCreateInvite} disabled={isInviteBusy} loading={isInviteBusy}>
              {t("admin.users.createAction")}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateInvite} className="admin-users__dialog-body">
            <TextField
              type="number"
              label={t("admin.users.inviteExpiryDays")}
              value={inviteExpiryDays}
              min={1}
              onChange={(event) => setInviteExpiryDays(event.currentTarget.value)}
              placeholder="7"
            />
          {createdToken ? (
            <TextField label={t("admin.users.createdToken")} value={createdToken} readOnly />
          ) : null}
          {inviteErrorKey ? <div className="admin-users__dialog-error">{t(inviteErrorKey)}</div> : null}
        </form>
      </Dialog>
    </section>
  );
}
