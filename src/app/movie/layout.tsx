import Strands from "@/components/backgrounds/Strands";
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

{
  /* 
  
  
  
  
  <Strands
  colors={["#F97316", "#7C3AED", "#06B6D4"]}
  count={5}
  speed={0.2}
  amplitude={1.3}
  waviness={3}
  thickness={0.7}
  glow={3}
  taper={0.5}
  spread={3}
  intensity={0.5}
  saturation={2}
  opacity={1}
  scale={3}
  glass
  refraction={2.7}
  dispersion={1.8}
  glassSize={1}
  hueShift={0}
></Strands>; 


*/
}
