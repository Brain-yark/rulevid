import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Building,
  Globe,
  MapPin,
  Lock,
  Shield,
  Save,
  Sparkles,
  Calendar,
  Eye,
  EyeOff,
  Radio,
  Ticket
} from 'lucide-react';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import type { User } from '../../../shared/types';

interface ProfilePageProps {
  onUpdateUser?: (updatedUser: User) => void;
  onNavigateToEvents?: () => void;
  onNavigateToHostStudio?: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({
  onUpdateUser,
  onNavigateToEvents,
  onNavigateToHostStudio,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [role, setRole] = useState('user');
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [pricingTier, setPricingTier] = useState('standard');

  // Password Change State
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const user: User = data.user;
        setName(user.name || '');
        setEmail(user.email || '');
        setCompanyName(user.companyName || '');
        setBio(user.bio || '');
        setLocation(user.location || '');
        setWebsiteUrl(user.websiteUrl || '');
        setAvatarUrl(user.avatarUrl || '');
        setRole(user.role || 'user');
        setCreatedAt(user.createdAt || null);
        setPricingTier(user.pricingTier || 'standard');
      } else {
        toast.error('Failed to load profile', 'Please check your connection and refresh.');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      toast.error('Network Error', 'Could not reach RuleVid servers.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    if (newPassword) {
      if (newPassword !== confirmPassword) {
        toast.warning('Password Mismatch', 'New password and confirmation do not match.');
        return;
      }
      if (!currentPassword) {
        toast.warning('Current Password Required', 'Please provide your current password to update security credentials.');
        return;
      }
    }

    try {
      setSaving(true);
      const payload: any = {
        name: name.trim(),
        companyName: companyName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        websiteUrl: websiteUrl.trim(),
        avatarUrl: avatarUrl.trim(),
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch(`${API_BASE}/api/v1/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Profile Updated', 'Your RuleVid profile has been saved successfully.');
        localStorage.setItem('user', JSON.stringify(data.user));
        if (onUpdateUser) onUpdateUser(data.user);

        // Reset password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordSection(false);
      } else {
        toast.error('Update Failed', data.error || 'Could not update profile.');
      }
    } catch (err) {
      console.error('Profile update error:', err);
      toast.error('Network Error', 'Failed to communicate with RuleVid server.');
    } finally {
      setSaving(false);
    }
  };

  const isHost = ['host', 'admin', 'moderator', 'super_admin'].includes(role);
  const initial = name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase() || 'U';

  return (
    <div className="profile-page animate-fade-in">
      {/* Profile Header Card */}
      <div className="profile-hero-card glass-card">
        <div className="profile-hero-content">
          <div className="avatar-wrapper">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name || email} className="profile-avatar-img" />
            ) : (
              <div className="profile-avatar-fallback">{initial}</div>
            )}
            <div className="avatar-badge">
              <Sparkles size={14} />
            </div>
          </div>

          <div className="profile-hero-info">
            <div className="name-role-row">
              <h2>{name || email.split('@')[0]}</h2>
              <span className={`role-pill role-${role}`}>
                {role === 'host'
                  ? 'HOST / CREATOR'
                  : role === 'super_admin'
                  ? 'SUPER ADMIN'
                  : role === 'admin'
                  ? 'ADMIN'
                  : role === 'moderator'
                  ? 'MODERATOR'
                  : 'ATTENDEE'}
              </span>
            </div>
            <p className="profile-email-text">{email}</p>
            {companyName && <p className="profile-company-text"><Building size={14} /> {companyName}</p>}

            <div className="profile-tags-row">
              {location && (
                <span className="profile-tag">
                  <MapPin size={13} /> {location}
                </span>
              )}
              {websiteUrl && (
                <a href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`} target="_blank" rel="noreferrer" className="profile-tag link-tag">
                  <Globe size={13} /> {websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              )}
              {createdAt && (
                <span className="profile-tag">
                  <Calendar size={13} /> Member since {new Date(createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="profile-hero-actions">
          {isHost ? (
            <button className="secondary-btn" onClick={onNavigateToHostStudio}>
              <Radio size={16} />
              <span>Host Studio</span>
            </button>
          ) : (
            <button className="secondary-btn" onClick={onNavigateToEvents}>
              <Ticket size={16} />
              <span>Discover Events</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Profile Settings Form */}
      <form onSubmit={handleSaveProfile} className="profile-form-grid">
        {/* Left Column: Personal & Brand Info */}
        <div className="profile-section-card glass-card">
          <div className="section-title-row">
            <UserIcon className="section-icon text-primary" size={20} />
            <div>
              <h3>Personal &amp; Brand Details</h3>
              <p className="section-subtitle">Manage how you appear across RuleVid live events and experiences</p>
            </div>
          </div>

          <div className="form-group">
            <label>Display Name</label>
            <div className="input-with-icon">
              <UserIcon size={16} className="input-icon" />
              <input
                type="text"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <span className="form-hint">Displayed to other attendees and hosts during live sessions.</span>
          </div>

          <div className="form-group">
            <label>Company / Organization Name</label>
            <div className="input-with-icon">
              <Building size={16} className="input-icon" />
              <input
                type="text"
                placeholder="e.g. Acme Media Corp / Independent Creator"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Bio / About You</label>
            <textarea
              rows={3}
              placeholder="Tell your audience or other members about yourself, your background, or topics you broadcast..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Location</label>
              <div className="input-with-icon">
                <MapPin size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="e.g. San Francisco, CA"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group flex-1">
              <label>Website / Social URL</label>
              <div className="input-with-icon">
                <Globe size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="e.g. https://yourwebsite.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Avatar / Photo Image URL</label>
            <div className="input-with-icon">
              <Sparkles size={16} className="input-icon" />
              <input
                type="url"
                placeholder="https://example.com/avatar.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>
            <span className="form-hint">Provide a direct link to your square profile image or logo.</span>
          </div>
        </div>

        {/* Right Column: Account & Security */}
        <div className="profile-section-card glass-card">
          <div className="section-title-row">
            <Shield className="section-icon text-primary" size={20} />
            <div>
              <h3>Account Credentials &amp; Security</h3>
              <p className="section-subtitle">Manage your login email, role permissions, and password</p>
            </div>
          </div>

          <div className="form-group">
            <label>Account Email (Read-Only)</label>
            <div className="input-with-icon readonly-input">
              <Mail size={16} className="input-icon" />
              <input type="email" value={email} disabled />
            </div>
            <span className="form-hint">Your email is used for login authentication and ticket purchase receipts.</span>
          </div>

          <div className="account-info-box glass">
            <div className="info-stat-item">
              <span className="stat-label">Platform Role</span>
              <span className="stat-val text-primary">{role.toUpperCase()}</span>
            </div>
            <div className="info-stat-item">
              <span className="stat-label">Infrastructure Tier</span>
              <span className="stat-val">{pricingTier.toUpperCase()}</span>
            </div>
            <div className="info-stat-item">
              <span className="stat-label">Email Status</span>
              <span className="stat-val text-success">VERIFIED</span>
            </div>
          </div>

          {/* Password Section Toggle */}
          <div className="password-accordion">
            <button
              type="button"
              className="toggle-password-btn"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
            >
              <Lock size={16} />
              <span>{showPasswordSection ? 'Cancel Password Change' : 'Change Account Password'}</span>
            </button>

            {showPasswordSection && (
              <div className="password-fields animate-fade-in">
                <div className="form-group">
                  <label>Current Password *</label>
                  <div className="input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter your current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required={!!newPassword}
                    />
                    <button type="button" className="pass-toggle" onClick={() => setShowPass(!showPass)}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>New Password *</label>
                  <div className="input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required={!!currentPassword}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirm New Password *</label>
                  <div className="input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required={!!newPassword}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="submit-row">
            <button type="submit" className="primary-btn save-btn" disabled={saving || loading}>
              <Save size={18} />
              <span>{saving ? 'Saving Profile...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </div>
      </form>

      <style>{`
        .profile-page {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .profile-hero-card {
          padding: 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1.5rem;
          border-radius: 20px;
        }

        .profile-hero-content {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .avatar-wrapper {
          position: relative;
        }

        .profile-avatar-img,
        .profile-avatar-fallback {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
        }

        .profile-avatar-fallback {
          background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.2rem;
          font-weight: 800;
          color: white;
        }

        .avatar-badge {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 26px;
          height: 26px;
          background: #10b981;
          border: 3px solid #0f172a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .profile-hero-info {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .name-role-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .name-role-row h2 {
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 0;
        }

        .role-pill {
          font-size: 0.7rem;
          font-weight: 800;
          padding: 0.2rem 0.6rem;
          border-radius: 6px;
          letter-spacing: 0.05em;
        }

        .role-host {
          background: rgba(99, 102, 241, 0.25);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.4);
        }

        .role-user {
          background: rgba(16, 185, 129, 0.2);
          color: #6ee7b7;
          border: 1px solid rgba(16, 185, 129, 0.35);
        }

        .role-super_admin,
        .role-admin {
          background: rgba(244, 63, 94, 0.25);
          color: #fda4af;
          border: 1px solid rgba(244, 63, 94, 0.45);
        }

        .role-moderator {
          background: rgba(59, 130, 246, 0.25);
          color: #93c5fd;
          border: 1px solid rgba(59, 130, 246, 0.4);
        }

        .profile-email-text {
          font-size: 0.95rem;
          color: var(--text-muted);
          margin: 0;
        }

        .profile-company-text {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          color: var(--text-main);
          font-weight: 600;
          margin: 0;
        }

        .profile-tags-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
          margin-top: 0.35rem;
        }

        .profile-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.78rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.05);
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          text-decoration: none;
        }

        .link-tag:hover {
          color: var(--primary);
          border-color: rgba(99, 102, 241, 0.3);
        }

        .profile-hero-actions {
          display: flex;
          gap: 0.75rem;
        }

        .profile-form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
          gap: 1.5rem;
        }

        .profile-section-card {
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          border-radius: 18px;
        }

        .section-title-row {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .section-title-row h3 {
          font-size: 1.15rem;
          font-weight: 700;
          margin: 0 0 0.2rem 0;
        }

        .section-subtitle {
          font-size: 0.82rem;
          color: var(--text-muted);
          margin: 0;
        }

        .section-icon {
          margin-top: 0.2rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .form-group label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-main);
        }

        .form-row {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .flex-1 {
          flex: 1;
          min-width: 160px;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 0.85rem;
          color: var(--text-muted);
          pointer-events: none;
        }

        .input-with-icon input,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.4rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          color: white;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .form-group textarea {
          padding: 0.75rem 1rem;
          resize: vertical;
        }

        .input-with-icon input:focus,
        .form-group textarea:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }

        .readonly-input input {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .form-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.1rem;
        }

        .account-info-box {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
          padding: 1rem;
          border-radius: 12px;
          text-align: center;
        }

        .info-stat-item {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .stat-label {
          font-size: 0.72rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .stat-val {
          font-size: 0.9rem;
          font-weight: 700;
        }

        .password-accordion {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 1.25rem;
        }

        .toggle-password-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          padding: 0.6rem 1rem;
          border-radius: 10px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
          width: fit-content;
          transition: var(--transition-fast);
        }

        .toggle-password-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.08);
        }

        .password-fields {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: rgba(0, 0, 0, 0.2);
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .pass-toggle {
          position: absolute;
          right: 0.75rem;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
        }

        .pass-toggle:hover {
          color: white;
        }

        .submit-row {
          margin-top: auto;
          padding-top: 1rem;
        }

        .save-btn {
          width: 100%;
          justify-content: center;
          padding: 0.85rem;
          font-size: 0.95rem;
        }

        .text-success {
          color: #10b981;
        }

        .text-primary {
          color: var(--primary);
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;
