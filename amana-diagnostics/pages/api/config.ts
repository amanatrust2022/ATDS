import type { NextApiRequest, NextApiResponse } from 'next';
import os from 'os';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let localIp = 'localhost';
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name];
    if (list) {
      for (const net of list) {
        // Skip loopback (127.0.0.1) and non-IPv4 addresses
        if (net.family === 'IPv4' && !net.internal) {
          // Exclude virtual/host-only network interfaces if possible
          if (!name.toLowerCase().includes('virtual') && !name.toLowerCase().includes('host-only')) {
            localIp = net.address;
            break;
          }
        }
      }
    }
    if (localIp !== 'localhost') break;
  }

  // Fallback to any IPv4 address if no primary physical one was matched
  if (localIp === 'localhost' && interfaces) {
    for (const name of Object.keys(interfaces)) {
      const list = interfaces[name];
      if (list) {
        for (const net of list) {
          if (net.family === 'IPv4' && !net.internal) {
            localIp = net.address;
            break;
          }
        }
      }
      if (localIp !== 'localhost') break;
    }
  }

  const port = process.env.PORT || '3000';

  res.status(200).json({
    localMode: process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true',
    serverIp: `${localIp}:${port}`,
  });
}
