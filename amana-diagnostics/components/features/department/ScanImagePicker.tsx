'use client';

import styles from './entryForm.module.css';

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

/**
 * The reference images a radiologist attaches to a report.
 *
 * Fifteen `<div onClick>` tiles: nothing focusable, nothing announced, nothing
 * operable without a mouse. Whether a tile was attached was carried by a
 * purple border and a nine-pixel tick in the corner — no text, and both of
 * them invisible to anyone working by keyboard. They are toggle buttons now,
 * and the count is stated in words.
 */
export default function ScanImagePicker({ images, onToggle }: Props) {
  const attached = images.length;

  return (
    <section className={styles['scans']} aria-labelledby="scan-picker-heading">
      <div className={styles['scansHead']}>
        <h3 className={styles['scansTitle']} id="scan-picker-heading">
          Key scan images
        </h3>
        <span className={styles['scansCount']}>
          {attached === 0
            ? 'No images attached'
            : `${attached} image${attached === 1 ? '' : 's'} attached`}
        </span>
      </div>

      <ul className={styles['scanGrid']}>
        {picOptions.map((pic) => {
          const path = `/uss-pics/${pic.file}`;
          const isAttached = images.includes(path);

          return (
            <li key={pic.file}>
              <button
                type="button"
                aria-pressed={isAttached}
                className={[styles['scanTile'], isAttached ? styles['scanOn'] : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onToggle(path)}
              >
                {/* Decorative here: the button already carries the name, and a
                  * duplicate alt would have it read twice. */}
                <img src={path} alt="" className={styles['scanThumb']} />
                <span className={styles['scanName']}>{pic.name}</span>
                <span className={styles['scanState']}>{isAttached ? 'Attached' : 'Attach'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
