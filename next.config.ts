import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 이미지 최적화 — Supabase Storage 도메인 허용
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**'
      }
    ]
  },

  // 환경변수 타입 안전성
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  }
};

export default nextConfig;
