import { useEffect, useRef } from "react";
import { startLoadingAnimation } from "../animations/loadingAnimation";
import "../styles/modules.css";

export default function Loader({ text = "ANALYZING..." }) {
  const ringRef = useRef(null);

  useEffect(() => {
    const anim = startLoadingAnimation(ringRef.current);
    return () => anim.pause();
  }, []);

  return (
    <div className="loader-wrap">
      <div className="loader-ring" ref={ringRef}></div>
      <div className="loader-text">{text}</div>
    </div>
  );
}
