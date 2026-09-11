'use client';

import { RiDeleteBinLine, RiLinkM, RiTimeLine, RiUserAddLine } from '@remixicon/react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  SkeletonRows,
  Table,
} from '@/components/ui';
import { reachableOrigin } from '@/lib/cloudOrigin';
import { ROLE_ORDER, initialsOf, avatarHue, roleInfo } from '@/lib/staffRoles';

import styles from './directory.module.css';

/**
 * Who is on the team, and how somebody joins it.
 *
 * Split out of StaffScreen, which held this, the performance dashboard and a
 * profile panel in one 1,700-line file. The data still lives in the parent —
 * this component decides nothing, it only shows what it is handed and calls
 * back.
 */

export interface InviteForm {
  email: string;
  role: string;
}

export function StaffDirectory({
  staff,
  invites,
  loading,
  form,
  onFormChange,
  submitting,
  onInvite,
  inviteLink,
  copiedId,
  onCopy,
  onRevoke,
  onRoleChange,
  onSelect,
  myId,
}: {
  staff: any[];
  invites: any[];
  loading: boolean;
  form: InviteForm;
  onFormChange: (form: InviteForm) => void;
  submitting: boolean;
  onInvite: (e: React.FormEvent) => void;
  inviteLink: string;
  copiedId: string | null;
  onCopy: (link: string, id: string) => void;
  onRevoke: (id: string) => void;
  onRoleChange: (id: string, role: string) => void;
  onSelect: (member: any) => void;
  /** The signed-in administrator, who may not change their own role. */
  myId: string | undefined;
}) {
  return (
    <div className={styles['layout']}>
      <div className={styles['aside']}>
        <Card>
          <CardHeader
            title={
              <span className={styles['cardTitle']}>
                <RiUserAddLine size={18} aria-hidden="true" /> Invite a colleague
              </span>
            }
            subtitle="They get an emailed link and set their own password. The link lasts seven days."
          />
          <CardBody>
            <form onSubmit={onInvite} className={styles['form']}>
              <Field label="Their email address" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => onFormChange({ ...form, email: e.target.value })}
                  placeholder="staff@example.com"
                  autoComplete="off"
                  required
                />
              </Field>

              <Field label="What they can do" hint={roleInfo(form.role).desc} required>
                <Select
                  value={form.role}
                  onChange={(e) => onFormChange({ ...form, role: e.target.value })}
                >
                  {ROLE_ORDER.map((role) => (
                    <option key={role} value={role}>
                      {roleInfo(role).label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Button
                type="submit"
                intent="primary"
                fullWidth
                loading={submitting}
                disabled={!form.email.trim()}
              >
                Send the invitation
              </Button>
            </form>

            {inviteLink && (
              <div className={styles['linkBox']}>
                <p className={styles['linkLabel']}>
                  <RiLinkM size={14} aria-hidden="true" /> Their link, if you would rather send
                  it yourself
                </p>
                <div className={styles['linkRow']}>
                  <Input
                    readOnly
                    value={inviteLink}
                    aria-label="Invitation link"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button size="sm" onClick={() => onCopy(inviteLink, 'main')}>
                    {copiedId === 'main' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {invites.length > 0 && (
          <Card>
            <CardHeader
              title={
                <span className={styles['cardTitle']}>
                  <RiTimeLine size={16} aria-hidden="true" /> Waiting to be accepted (
                  {invites.length})
                </span>
              }
            />
            <CardBody flush>
              <ul className={styles['invites']}>
                {invites.map((inv) => {
                  const link = `${reachableOrigin()}/invite/${inv.token}`;
                  return (
                    <li key={inv.id} className={styles['invite']}>
                      <div className={styles['inviteHead']}>
                        <span className={styles['inviteEmail']}>{inv.email}</span>
                        <Button
                          intent="dangerQuiet"
                          size="sm"
                          aria-label={`Cancel the invitation to ${inv.email}`}
                          onClick={() => onRevoke(inv.id)}
                        >
                          <RiDeleteBinLine size={15} aria-hidden="true" />
                        </Button>
                      </div>

                      <div className={styles['inviteMeta']}>
                        <Badge tone={roleInfo(inv.role).tone}>{roleInfo(inv.role).label}</Badge>
                        <span>
                          Expires {new Date(inv.expires_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className={styles['linkRow']}>
                        <Input
                          readOnly
                          value={link}
                          aria-label={`Invitation link for ${inv.email}`}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <Button size="sm" onClick={() => onCopy(link, inv.id)}>
                          {copiedId === inv.id ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader
          title={`Team members (${staff.length})`}
          subtitle="Open anyone to see their details and signature."
        />
        <CardBody flush>
          {loading ? (
            <div className={styles['loading']}>
              <SkeletonRows rows={5} columns={[4, 2, 2]} />
            </div>
          ) : (
            <Table
              caption="Everyone with access to this workspace"
              rows={staff}
              rowKey={(s) => s.id}
              onRowClick={onSelect}
              empty={
                <EmptyState title="Nobody here yet" compact>
                  Invite your first colleague with the form beside this.
                </EmptyState>
              }
              columns={[
                {
                  key: 'person',
                  header: 'Staff member',
                  render: (s: any) => (
                    <span className={styles['person']}>
                      <span
                        className={styles['avatar']}
                        style={{ ['--avatar-hue' as string]: avatarHue(s.full_name) }}
                        aria-hidden="true"
                      >
                        {initialsOf(s.full_name)}
                      </span>
                      <span className={styles['personText']}>
                        <span className={styles['personName']}>
                          {s.full_name || 'Not set up yet'}
                        </span>
                        <span className={styles['personEmail']}>
                          {s.email || 'No email on file'}
                        </span>
                      </span>
                    </span>
                  ),
                },
                {
                  key: 'role',
                  header: 'What they can do',
                  render: (s: any) => (
                    // Stop the click here: changing a role must not also open
                    // the profile panel behind the select.
                    <span onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={s.role}
                        aria-label={`Role for ${s.full_name || s.email || 'this person'}`}
                        disabled={s.id === myId}
                        onChange={(e) => onRoleChange(s.id, e.target.value)}
                      >
                        {ROLE_ORDER.map((role) => (
                          <option key={role} value={role}>
                            {roleInfo(role).label}
                          </option>
                        ))}
                      </Select>
                      {s.id === myId && <span className={styles['you']}>You</span>}
                    </span>
                  ),
                },
                {
                  key: 'signature',
                  header: 'Signature',
                  render: (s: any) =>
                    s.signature_url ? (
                      <Badge tone="success">On file</Badge>
                    ) : (
                      // Not a failure — most roles never sign anything. It is
                      // only the people who release reports who need one.
                      <Badge tone="neutral">Not uploaded</Badge>
                    ),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
