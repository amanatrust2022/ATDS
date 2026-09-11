'use client';

import {
  RiAlertLine,
  RiCalendarEventLine,
  RiFingerprintLine,
  RiMailLine,
  RiShieldUserLine,
} from '@remixicon/react';

import { Alert, Badge, Button, Dialog, Field, Select } from '@/components/ui';
import { ROLE_ORDER, avatarHue, initialsOf, parseNameDetails, roleInfo } from '@/lib/staffRoles';

import styles from './profile.module.css';

/**
 * One colleague's details.
 *
 * Was a hand-rolled overlay: a fixed div with a blurred scrim, a click-outside
 * handler, and a close button whose only affordance was a rotation on hover.
 * No focus trap, no Escape, no restored focus, and the scrim was a
 * `rgba(15, 23, 42, 0.65)` that stayed navy in both themes. It is the shared
 * Dialog now, which is Radix underneath and has solved all of that.
 */
export function StaffProfileModal({
  member,
  onClose,
  onRoleChange,
  onRemove,
  isMe,
}: {
  member: any | null;
  onClose: () => void;
  onRoleChange: (id: string, role: string) => void;
  onRemove: (member: any) => void;
  isMe: boolean;
}) {
  if (!member) return null;

  const name = parseNameDetails(member);
  const role = roleInfo(member.role);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="lg"
      title={member.full_name || 'Not set up yet'}
      description={member.email || 'No email on file'}
    >
      <div className={styles['identity']}>
        <span
          className={styles['avatar']}
          style={{ ['--avatar-hue' as string]: avatarHue(member.full_name) }}
          aria-hidden="true"
        >
          {initialsOf(member.full_name)}
        </span>
        <span className={styles['identityText']}>
          <Badge tone={role.tone}>{role.label}</Badge>
          {isMe && <span className={styles['you']}>This is you</span>}
        </span>
      </div>

      <div className={styles['columns']}>
        <div className={styles['column']}>
          <section>
            <h3 className={styles['sectionTitle']}>Name on file</h3>
            {/* A guess when the row only ever had one `full_name` string, which
              * is why it is shown here and never written back. */}
            <dl className={styles['nameGrid']}>
              <div>
                <dt>Title</dt>
                <dd>{name.title}</dd>
              </div>
              <div>
                <dt>First name</dt>
                <dd>{name.firstName}</dd>
              </div>
              <div>
                <dt>Middle name</dt>
                <dd>{name.lastName}</dd>
              </div>
              <div>
                <dt>Surname</dt>
                <dd>{name.surname}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className={styles['sectionTitle']}>Signature</h3>
            {member.signature_url ? (
              <figure className={styles['signature']}>
                <img
                  src={member.signature_url}
                  alt={`${member.full_name || 'This person'}'s signature`}
                />
                <figcaption>Used when they release a report.</figcaption>
              </figure>
            ) : (
              <div className={styles['noSignature']}>
                <RiAlertLine size={16} aria-hidden="true" />
                <p>
                  Nothing uploaded. Lab and radiology staff need one before they can sign a
                  report off.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className={styles['column']}>
          <dl className={styles['facts']}>
            <div className={styles['fact']}>
              <RiMailLine size={16} aria-hidden="true" />
              <div>
                <dt>Email</dt>
                <dd>{member.email || 'No email on file'}</dd>
              </div>
            </div>
            <div className={styles['fact']}>
              <RiFingerprintLine size={16} aria-hidden="true" />
              <div>
                <dt>Staff ID</dt>
                <dd className={styles['mono']}>{member.id}</dd>
              </div>
            </div>
            {member.created_at && (
              <div className={styles['fact']}>
                <RiCalendarEventLine size={16} aria-hidden="true" />
                <div>
                  <dt>Joined</dt>
                  <dd>{new Date(member.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</dd>
                </div>
              </div>
            )}
          </dl>

          <div className={styles['permissions']}>
            <p className={styles['permissionsHead']}>
              <RiShieldUserLine size={16} aria-hidden="true" />
              {role.label}
            </p>
            <p className={styles['permissionsBody']}>{role.desc}</p>
          </div>

          <div className={styles['manage']}>
            <Field
              label="Change what they can do"
              hint={isMe ? 'You cannot change your own role.' : undefined}
            >
              <Select
                value={member.role}
                disabled={isMe}
                onChange={(e) => onRoleChange(member.id, e.target.value)}
              >
                {/* All five. This list used to omit lab_tech, so opening a Lab
                  * Technician showed a select with no matching option — the
                  * browser fell back to the first, and an administrator read
                  * "Receptionist" for someone who was nothing of the kind. */}
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {roleInfo(r).label}
                  </option>
                ))}
              </Select>
            </Field>

            {!isMe && (
              <>
                <Alert tone="warning">
                  Removing someone takes their access away immediately. Reports they have
                  already signed keep their name.
                </Alert>
                <Button intent="danger" onClick={() => onRemove(member)}>
                  Remove {member.full_name || 'this person'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
