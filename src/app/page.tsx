"use client";

import { useEffect } from "react";

export default function MovieApp() {
  useEffect(() => {
    location.assign("/movie");
  }, []);
  return (
    <>
      <div className="w-full h-full relative">
        <div>Loading...</div>
      </div>
    </>
  );
}
