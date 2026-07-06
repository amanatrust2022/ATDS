import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
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

  return NextResponse.json({
    localMode: process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true',
    serverIp: `${localIp}:${port}`,
  });
}
