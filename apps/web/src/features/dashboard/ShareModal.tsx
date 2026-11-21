import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, Link2, Trash2, UserPlus } from 'lucide-react';
import type { BoardSummary, Role } from '@syncboard/shared';
import { boardsApi, type MemberDto, type ShareLinkDto } from '../../app/api';
import { useAuth } from '../../app/AuthProvider';
import { Avatar, Badge, Button, Dropdown, Modal } from '../../components/ui';
import { useUiStore } from '../../stores/useUiStore';

const ASSIGNABLE: Role[] = ['EDITOR', 'COMMENTER', 'VIEWER'];
const LINK_ROLES: Array<Exclude<Role, 'OWNER'>> = ['VIEWER', 'COMMENTER', 'EDITOR'];

interface ShareModalProps {
  board: BoardSummary | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export function ShareModal({ board, open, onClose, onChanged }: ShareModalProps) {
  const { user } = useAuth();
  const showToast = useUiStore((state) => state.showToast);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [link, setLink] = useState<ShareLinkDto | null>(null);
  const [invite, setInvite] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('VIEWER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!board) return;
    try {
      const [nextMembers] = await Promise.all([boardsApi.members(board.id)]);
      setMembers(nextMembers);
      setLink(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load members.');
    }
  }, [board]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function inviteUser(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!board || !invite.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const value = invite.trim();
      await boardsApi.addMember(board.id, {
        ...(value.includes('@') ? { email: value } : { username: value }),
        role: inviteRole,
      });
      setInvite('');
      await load();
      onChanged?.();
      showToast('Invitation sent');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not invite that user.');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(member: MemberDto, role: Role): Promise<void> {
    if (!board) return;
    try {
      await boardsApi.updateMember(board.id, member.userId, role);
      await load();
      onChanged?.();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not change role.');
    }
  }

  async function revoke(member: MemberDto): Promise<void> {
    if (!board) return;
    try {
      await boardsApi.removeMember(board.id, member.userId);
      await load();
      onChanged?.();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not revoke access.');
    }
  }

  async function toggleLink(role: Exclude<Role, 'OWNER'>): Promise<void> {
    if (!board) return;
    try {
      if (link) {
        await boardsApi.deleteShareLink(board.id);
        setLink(null);
        showToast('Invite link disabled');
      } else {
        setLink(await boardsApi.createShareLink(board.id, role));
        showToast('Invite link ready');
      }
      onChanged?.();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not update invite link.');
    }
  }

  async function copyLink(): Promise<void> {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(new URL(link.url, window.location.origin).toString());
      showToast('Link copied');
    } catch {
      showToast('Copy failed — select the link manually');
    }
  }

  const isOwner = board?.ownerId === user?.id || board?.role === 'OWNER';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share board"
      description={board ? `Manage access to “${board.title}”.` : undefined}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {!isOwner ? (
        <p className="sb-hint">
          Only the board owner can change permissions. You can still copy the existing invite link.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <form onSubmit={(event) => void inviteUser(event)} className="flex flex-col gap-2">
            <label className="sb-label" htmlFor="invite-input">Invite by email or username</label>
            <div className="flex gap-2">
              <input
                id="invite-input"
                className="sb-input"
                value={invite}
                onChange={(event) => setInvite(event.target.value)}
                placeholder="teammate@studio.com"
              />
              <Dropdown
                trigger={
                  <Button aria-label="Invite role" className="flex-none">
                    {inviteRole.toLowerCase()}
                  </Button>
                }
                items={ASSIGNABLE.map((role) => ({
                  label: role.toLowerCase(),
                  checked: inviteRole === role,
                  onSelect: () => setInviteRole(role),
                }))}
              />
              <Button type="submit" variant="primary" loading={busy} aria-label="Send invitation">
                <UserPlus size={15} />
              </Button>
            </div>
          </form>

          {error ? (
            <p role="alert" className="text-[12px]" style={{ color: 'var(--sb-danger)' }}>{error}</p>
          ) : null}

          <div>
            <span className="sb-label">People with access</span>
            <div className="flex flex-col gap-1">
              {members.length === 0 ? (
                <p className="sb-hint">No members yet — only you can access this board.</p>
              ) : (
                members.map((member) => (
                  <div key={member.userId} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                    <Avatar name={member.displayName} color={member.avatarColor} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{member.displayName}</div>
                      <div className="truncate text-[11px]" style={{ color: 'var(--sb-secondary)' }}>
                        {member.email || `@${member.username}`}
                      </div>
                    </div>
                    {member.role === 'OWNER' ? (
                      <Badge>Owner</Badge>
                    ) : (
                      <>
                        <Dropdown
                          trigger={<Button size="sm" aria-label={`Role for ${member.displayName}`}>{member.role.toLowerCase()}</Button>}
                          items={ASSIGNABLE.map((role) => ({
                            label: role.toLowerCase(),
                            checked: member.role === role,
                            onSelect: () => void changeRole(member, role),
                          }))}
                        />
                        <button
                          type="button"
                          className="sb-icon-btn sb-icon-btn--sm"
                          aria-label={`Revoke access for ${member.displayName}`}
                          onClick={() => void revoke(member)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border p-3.5" style={{ borderColor: 'var(--sb-line)' }}>
            <div className="flex items-center gap-2">
              <Link2 size={15} strokeWidth={1.8} />
              <span className="text-[13px] font-medium">Shareable link</span>
            </div>
            <p className="sb-hint mt-1">
              Anyone with the link can join with the role you choose. Links can be disabled at any time.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Dropdown
                trigger={<Button size="sm" aria-label="Invite link role">{link?.role ?? 'viewer'}</Button>}
                items={LINK_ROLES.map((role) => ({
                  label: role.toLowerCase(),
                  checked: link?.role === role,
                  onSelect: () => void toggleLink(role),
                }))}
              />
              {link ? (
                <>
                  <input
                    className="sb-input sb-mono min-w-0 flex-1 text-[11px]"
                    readOnly
                    value={link ? new URL(link.url, window.location.origin).toString() : ''}
                    aria-label="Invite link"
                  />
                  <Button size="sm" onClick={() => void copyLink()} aria-label="Copy invite link">
                    <Copy size={14} /> Copy
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void toggleLink('VIEWER')}>
                    Disable
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="primary" onClick={() => void toggleLink('VIEWER')}>
                  Create link
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
