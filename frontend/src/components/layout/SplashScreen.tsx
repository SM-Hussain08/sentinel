import titleLogo from "../../assets/title-logo.png";
import backgroundLogo from "../../assets/background-light.png";


interface SplashScreenProps {
  onComplete: () => void;
}


function SplashScreen({
  onComplete,
}: SplashScreenProps) {
  return (
    <div
      className="
        sentinel-splash
        fixed inset-0 z-[9999]
        flex items-center justify-center
        overflow-hidden
        bg-[#050910]
      "
      onAnimationEnd={onComplete}
    >
      {/* Decorative background glow */}
      <div
        className="
          pointer-events-none
          absolute left-1/2 top-1/2
          h-[420px] w-[420px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-cyan-500/10
          blur-[120px]
        "
      />

      {/* Large watermark */}
      <img
        src={backgroundLogo}
        alt=""
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          h-[620px] w-[620px]
          object-contain
          opacity-[0.025]
        "
      />

      {/* Main splash content */}
      <div
        className="
          sentinel-splash-content
          relative z-10
          flex w-full max-w-xl
          flex-col items-center
          px-8 text-center
        "
      >
        {/* Full SENTINEL logo */}
        <div
          className="
            relative flex
            items-center justify-center
          "
        >
          <div
            className="
              absolute
              h-40 w-40
              rounded-full
              bg-cyan-400/10
              blur-3xl
            "
          />

          <img
            src={titleLogo}
            alt="SENTINEL — AI Powered Security Operations"
            className="
              sentinel-logo-enter
              relative
              max-h-44
              w-auto
              max-w-[420px]
              object-contain
              drop-shadow-[0_0_28px_rgba(34,211,238,0.18)]
            "
          />
        </div>

        {/* Divider */}
        <div
          className="
            mt-8 h-px w-28
            bg-gradient-to-r
            from-transparent
            via-cyan-400/50
            to-transparent
          "
        />

        {/* Loading message */}
        <div
          className="
            mt-6 flex
            items-center gap-2.5
          "
        >
          <span
            className="
              h-1.5 w-1.5
              animate-pulse
              rounded-full
              bg-emerald-400
              shadow-[0_0_10px_rgba(52,211,153,0.8)]
            "
          />

          <p
            className="
              text-[11px]
              font-medium
              uppercase
              tracking-[0.22em]
              text-slate-500
            "
          >
            Initializing Security Intelligence
          </p>
        </div>

        {/* Progress track */}
        <div
          className="
            mt-5 h-[2px]
            w-48
            overflow-hidden
            rounded-full
            bg-slate-800
          "
        >
          <div
            className="
              sentinel-splash-progress
              h-full
              rounded-full
              bg-gradient-to-r
              from-cyan-600
              via-cyan-300
              to-blue-500
            "
          />
        </div>

        <p
          className="
            mt-5 text-[10px]
            uppercase
            tracking-[0.16em]
            text-slate-700
          "
        >
          Behavioral Analytics · Incident Intelligence
        </p>
      </div>
    </div>
  );
}


export default SplashScreen;