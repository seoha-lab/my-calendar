'use client';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">페이지를 찾을 수 없습니다</h1>
        <p className="text-gray-600">요청한 페이지가 존재하지 않습니다.</p>
        <Link href="/" className="btn">홈으로</Link>
      </div>
    </div>
  );
}
