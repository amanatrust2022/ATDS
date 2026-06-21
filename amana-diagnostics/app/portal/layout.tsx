import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Patient Portal — Amana Trust Diagnostics',
  description: 'Securely access your diagnostic results and medical history at Amana Trust Diagnostics.',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          background: #f4f6fb;
        }
        input:focus {
          outline: 2px solid #0563c1;
          outline-offset: 0;
          border-color: #0563c1 !important;
        }
        button:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        button:active:not(:disabled) {
          transform: translateY(0);
        }
        @media print {
          header, footer, .no-print {
            display: none !important;
          }
          body {
            background: white;
          }
        }
      `}</style>
      {children}
    </>
  );
}
