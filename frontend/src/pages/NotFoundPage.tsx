import {
  useNavigate,
} from "react-router-dom";


function NotFoundPage() {
  const navigate =
    useNavigate();


  return (
    <main
      className="
        flex
        min-h-screen
        items-center
        justify-center
        bg-[#0b111b]/55
        px-4
      "
    >
      <section
        className="
          relative
          w-full
          max-w-2xl
          overflow-hidden
          rounded-2xl
          border
          border-slate-700/55
          bg-[#101826]/90
          p-8
          text-center
          shadow-[0_18px_55px_rgba(0,0,0,0.18)]
        "
      >
        <div
          className="
            pointer-events-none
            absolute
            left-1/2
            top-[-120px]
            h-72 w-72
            -translate-x-1/2
            rounded-full
            bg-cyan-400/[0.025]
            blur-[100px]
          "
        />


        <div
          className="
            relative
          "
        >
          <div
            className="
              mx-auto
              flex
              h-14 w-14
              items-center
              justify-center
              rounded-2xl
              border
              border-cyan-900/45
              bg-cyan-950/15
              font-mono
              text-sm
              font-semibold
              text-cyan-300
            "
          >
            404
          </div>


          <p
            className="
              mt-6
              text-[10px]
              font-semibold
              uppercase
              tracking-[0.19em]
              text-cyan-400
            "
          >
            SENTINEL Navigation
          </p>


          <h1
            className="
              mt-3
              text-3xl
              font-semibold
              tracking-tight
              text-white
            "
          >
            Workspace not found
          </h1>


          <p
            className="
              mx-auto
              mt-4
              max-w-lg
              text-sm
              leading-6
              text-slate-500
            "
          >
            The requested SENTINEL route
            does not exist or is not
            currently available.
          </p>


          <div
            className="
              mt-7
              flex
              flex-col
              justify-center
              gap-2
              sm:flex-row
            "
          >
            <button
              type="button"
              onClick={() => {
                navigate(
                  "/",
                );
              }}
              className="
                rounded-xl
                border
                border-cyan-900/60
                bg-cyan-950/20
                px-4 py-2.5
                text-xs
                font-medium
                text-cyan-300
                transition-all
                duration-200
                hover:-translate-y-0.5
                hover:border-cyan-700/70
                hover:bg-cyan-950/30
              "
            >
              Go to Overview
            </button>


            <button
              type="button"
              onClick={() => {
                navigate(
                  -1,
                );
              }}
              className="
                rounded-xl
                border
                border-slate-800
                bg-[#0b111c]
                px-4 py-2.5
                text-xs
                font-medium
                text-slate-400
                transition-all
                duration-200
                hover:-translate-y-0.5
                hover:border-slate-700
                hover:text-slate-200
              "
            >
              ← Go Back
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}


export default NotFoundPage;