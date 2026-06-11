import { SideRays } from "../../components/backgrounds/SideRays";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <div className="w-full h-full relative overflow-hidden">
        <div className="w-full h-full absolute top-0 left-0 -z-1 bg-[#041b2c] ">
          <SideRays
            rayColor1="#6cffff"
            rayColor2="#96ffde"
            origin="top-right"
            speed={2.5}
            intensity={2}
            spread={2}
            tilt={0}
            saturation={1.5}
            blend={0.75}
            falloff={1.6}
            opacity={1}
          />
        </div>
        {children}
      </div>
    </>
  );
}
