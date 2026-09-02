'use client';

interface Props {
  /** Paths already attached to the report, e.g. `/uss-pics/BPD.jpg`. */
  images: string[];
  onToggle: (path: string) => void;
}

const picOptions = [
  { name: 'Normal Pelvic Scan', file: 'N SCAN PELVIC.jpeg' },
  { name: 'Obstetric (BPD)', file: 'BPD.jpg' },
  { name: 'Obstetric (CRL)', file: 'CRL.jpg' },
  { name: 'Uterine Fibroid', file: 'FIBROID.jpg' },
  { name: 'Pelvic Inflammatory Disease (PID)', file: 'PID.jpg' },
  { name: 'Retained Products (RPOC)', file: 'RPOC.jpg' },
  { name: 'Adenomyosis', file: 'ADENOMYOSIS.jpg' },
  { name: 'Simple Ovarian Cyst', file: 'SIMPLE OVA CYST.jpg' },
  { name: 'Hemorrhagic Ovarian Cyst', file: 'HAEM OV CYST.jpg' },
  { name: 'Twin Pregnancy (Cephalic/Breech)', file: 'TWIN CEPH AND BREECH.jpg' },
  { name: 'Twin Pregnancy (CRL)', file: 'TWIN CRL.jpg' },
  { name: 'Twin Pregnancy (GS)', file: 'TWIN GS.jpg' },
  { name: 'Bladder Stone', file: 'BLADDER STONE.jpg' },
  { name: 'Bladder Diverticulum', file: 'BLADDER DIVERTICULUM.jpg' },
  { name: 'Benign Prostatic Hyperplasia (BPH)', file: 'BPH.jpg' },
];

export default function ScanImagePicker({ images, onToggle }: Props) {
  return (
    <div style={{
      border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-lg)',
      padding: '1rem', background: '#f9fafb'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', margin: 0 }}>
          Attach Key Scan Images (Optional)
        </h4>
        {images.length > 0 && (
          <span style={{ fontSize: '0.72rem', background: '#d1fae5', color: '#065f46', padding: '0.1rem 0.5rem', borderRadius: '9999px', fontWeight: 600 }}>
            {images.length} Image(s) Attached
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
        {picOptions.map(pic => {
          const path = `/uss-pics/${pic.file}`;
          const isAttached = images.includes(path);
          return (
            <div
              key={pic.file}
              onClick={() => onToggle(path)}
              style={{
                border: `2px solid ${isAttached ? '#7c3aed' : '#e5e7eb'}`,
                borderRadius: 'var(--radius)', background: 'white',
                padding: '0.4rem', cursor: 'pointer', position: 'relative',
                textAlign: 'center', overflow: 'hidden', display: 'flex',
                flexDirection: 'column', alignItems: 'center', gap: '0.25rem'
              }}
            >
              <img
                src={path}
                style={{ width: '100%', height: '50px', objectFit: 'cover', borderRadius: '2px' }}
                alt={pic.name}
              />
              <span style={{ fontSize: '0.62rem', fontWeight: 600, display: 'block', height: '28px', overflow: 'hidden', color: '#374151' }}>
                {pic.name}
              </span>
              {isAttached && (
                <div style={{
                  position: 'absolute', top: 2, right: 2,
                  background: '#7c3aed', color: 'white', width: 14, height: 14,
                  borderRadius: '50%', fontSize: '9px', fontWeight: 'bold',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  ✓
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
