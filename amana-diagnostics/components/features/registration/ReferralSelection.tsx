import React from 'react';
import { RiAddLine, RiSearchLine, RiCloseLine } from '@remixicon/react';
import { ReferringDoctor, ReferringFacility } from '@/lib/store';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import Field from './Field';
import { inputStyle, dropItemStyle } from './styles';

interface ReferralSelectionProps {
  doctors: ReferringDoctor[];
  facilities: ReferringFacility[];
  errors: Record<string, string>;

  selectedDoctorId: string;
  setSelectedDoctorId: (id: string) => void;
  doctorSearch: string;
  setDoctorSearch: (q: string) => void;
  showDoctorDrop: boolean;
  setShowDoctorDrop: (show: boolean) => void;
  doctorRef: React.RefObject<HTMLDivElement | null>;
  onQuickAddDoctor: () => void;

  selectedFacilityId: string;
  setSelectedFacilityId: (id: string) => void;
  facilitySearch: string;
  setFacilitySearch: (q: string) => void;
  showFacilityDrop: boolean;
  setShowFacilityDrop: (show: boolean) => void;
  facilityRef: React.RefObject<HTMLDivElement | null>;
  onQuickAddFacility: () => void;
}

const quickBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--teal-600)', fontSize: '0.7rem',
  fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.15rem',
};

export default function ReferralSelection({
  doctors, facilities, errors,
  selectedDoctorId, setSelectedDoctorId, doctorSearch, setDoctorSearch,
  showDoctorDrop, setShowDoctorDrop, doctorRef, onQuickAddDoctor,
  selectedFacilityId, setSelectedFacilityId, facilitySearch, setFacilitySearch,
  showFacilityDrop, setShowFacilityDrop, facilityRef, onQuickAddFacility,
}: ReferralSelectionProps) {
  const setForm = useRegistrationStore(state => state.setForm);

  const matchingDoctors = doctors.filter(d => !doctorSearch || d.name.toLowerCase().includes(doctorSearch.toLowerCase()));
  const matchingFacilities = facilities.filter(f => !facilitySearch || f.name.toLowerCase().includes(facilitySearch.toLowerCase()));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field
        label="Referred By (Doctor) *"
        error={errors.referredBy}
        actionNode={
          <button type="button" onClick={onQuickAddDoctor} style={quickBtnStyle}>
            <RiAddLine size={12} /> Quick Register
          </button>
        }
      >
        <div ref={doctorRef} style={{ position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <RiSearchLine size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
            <input
              style={{ ...inputStyle(!!errors.referredBy), paddingLeft: 26 }}
              value={selectedDoctorId ? (selectedDoctorId === 'none' ? 'Not referred by anyone' : `Dr. ${doctors.find(d => d.id === selectedDoctorId)?.name || ''}`) : doctorSearch}
              onChange={e => { setDoctorSearch(e.target.value); setSelectedDoctorId(''); setShowDoctorDrop(true); }}
              onFocus={() => setShowDoctorDrop(true)}
              placeholder="Search or type doctor name…"
            />
            {selectedDoctorId && (
              <button onClick={() => { setSelectedDoctorId(''); setDoctorSearch(''); setForm({ referredBy: '' }); }} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex' }}>
                <RiCloseLine size={14} />
              </button>
            )}
          </div>
          {showDoctorDrop && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--gray-300)', zIndex: 50, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {/* Free-text option */}
              {doctorSearch && !selectedDoctorId && (
                <div onClick={() => { setForm({ referredBy: doctorSearch }); setShowDoctorDrop(false); }} style={dropItemStyle}>
                  <span style={{ fontStyle: 'italic', color: 'var(--gray-500)' }}>Use "{doctorSearch}" as typed</span>
                </div>
              )}
              {matchingDoctors.map(d => (
                <div key={d.id} onClick={() => { setSelectedDoctorId(d.id); setDoctorSearch(''); setShowDoctorDrop(false); setForm({ referredBy: `Dr. ${d.name}` }); }} style={dropItemStyle}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>Dr. {d.name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>
                    {d.facility_name || 'Independent'} · {d.commission_value > 0 ? `${d.commission_type === 'percentage' ? d.commission_value + '%' : '₦' + d.commission_value} commission` : 'No commission'}
                  </div>
                </div>
              ))}
              {matchingDoctors.length === 0 && !doctorSearch && (
                <div style={{ padding: '0.6rem 0.75rem', color: 'var(--gray-400)', fontSize: '0.78rem' }}>No doctors in database. Type to use a custom name.</div>
              )}

              {/* Not referred by anyone option */}
              <div
                onClick={() => {
                  setSelectedDoctorId('none');
                  setDoctorSearch('');
                  setShowDoctorDrop(false);
                  setForm({ referredBy: 'Not referred by anyone', referringFacility: 'None / Walk-in' });
                  setSelectedFacilityId('none');
                  setFacilitySearch('');
                }}
                style={{ ...dropItemStyle, borderTop: '1px solid var(--gray-200)', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.05rem' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-100)'}
                onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
              >
                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--gray-700)' }}>Not referred by anyone</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>Direct walk-in / self-referral</div>
              </div>
            </div>
          )}
        </div>
      </Field>

      <Field
        label="Referring Facility *"
        error={errors.referringFacility}
        actionNode={
          <button type="button" onClick={onQuickAddFacility} style={quickBtnStyle}>
            <RiAddLine size={12} /> Quick Register
          </button>
        }
      >
        <div ref={facilityRef} style={{ position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <RiSearchLine size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
            <input
              style={{ ...inputStyle(!!errors.referringFacility), paddingLeft: 26 }}
              value={selectedFacilityId ? (selectedFacilityId === 'none' ? 'None / Walk-in' : facilities.find(f => f.id === selectedFacilityId)?.name || '') : facilitySearch}
              onChange={e => { setFacilitySearch(e.target.value); setSelectedFacilityId(''); setShowFacilityDrop(true); }}
              onFocus={() => setShowFacilityDrop(true)}
              placeholder="Search or type facility name…"
            />
            {selectedFacilityId && (
              <button onClick={() => { setSelectedFacilityId(''); setFacilitySearch(''); setForm({ referringFacility: '' }); }} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex' }}>
                <RiCloseLine size={14} />
              </button>
            )}
          </div>
          {showFacilityDrop && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--gray-300)', zIndex: 50, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {facilitySearch && !selectedFacilityId && (
                <div onClick={() => { setForm({ referringFacility: facilitySearch }); setShowFacilityDrop(false); }} style={dropItemStyle}>
                  <span style={{ fontStyle: 'italic', color: 'var(--gray-500)' }}>Use "{facilitySearch}" as typed</span>
                </div>
              )}
              {matchingFacilities.map(f => (
                <div key={f.id} onClick={() => { setSelectedFacilityId(f.id); setFacilitySearch(''); setShowFacilityDrop(false); setForm({ referringFacility: f.name }); }} style={dropItemStyle}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{f.name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>
                    {f.address || ''}{f.commission_value > 0 ? ` · ${f.commission_type === 'percentage' ? f.commission_value + '%' : '₦' + f.commission_value} commission` : ''}
                  </div>
                </div>
              ))}
              {matchingFacilities.length === 0 && !facilitySearch && (
                <div style={{ padding: '0.6rem 0.75rem', color: 'var(--gray-400)', fontSize: '0.78rem' }}>No facilities in database. Type to use a custom name.</div>
              )}

              {/* None / Walk-in option */}
              <div
                onClick={() => {
                  setSelectedFacilityId('none');
                  setFacilitySearch('');
                  setShowFacilityDrop(false);
                  setForm({ referringFacility: 'None / Walk-in' });
                }}
                style={{ ...dropItemStyle, borderTop: '1px solid var(--gray-200)', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.05rem' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-100)'}
                onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
              >
                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--gray-700)' }}>None / Walk-in</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>Direct walk-in patient</div>
              </div>
            </div>
          )}
        </div>
      </Field>
    </div>
  );
}
