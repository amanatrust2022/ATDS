process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE = 'true';
process.env.NODE_ENV = 'development';

import { GET } from './app/api/patients/route';

(async () => {
  try {
    const req = new Request('http://localhost:3000/api/patients?organizationId=23769997-a11f-492c-bb12-6b9331dc1009');
    const res = await GET(req);
    console.log('Status code:', res.status);
    const data = await res.json();
    console.log('Response data:', data);
  } catch (e) {
    console.error('Request failed:', e);
  }
})();
