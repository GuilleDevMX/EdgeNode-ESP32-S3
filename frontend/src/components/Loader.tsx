// src/components/Loader.tsx
const Loader = ({ fullScreen = false }: { fullScreen?: boolean }) => {
  return (
    <>
        <div className={`flex flex-col items-center justify-center bg-transparent p-4 ${fullScreen ? 'min-h-screen' : 'w-full py-12'}`}>
            <div className="mb-4 flex items-center gap-2">
                <span className="h-2 w-2 animate-ping rounded-full bg-blue-500"></span>
                <span className="font-mono text-xs tracking-widest text-zinc-500 uppercase">Fetching Data...</span>
            </div>

            <div className="relative h-72 w-44 animate-pulse rounded-sm border border-zinc-950 bg-[#2d2d2d] shadow-2xl">
                <div className="absolute top-0 right-0 left-0 flex h-10 justify-center rounded-t-sm bg-[#1a1a1a] pt-2 opacity-80">
                <div className="flex h-6 w-24 flex-col justify-between border-x-2 border-b-2 border-zinc-700">
                    <div className="h-[1px] w-full bg-zinc-700"></div>
                    <div className="h-[1px] w-full bg-zinc-700"></div>
                </div>
                </div>

                <div className="absolute top-12 left-1/2 flex h-22 w-26 -translate-x-1/2 flex-col items-center justify-center rounded-sm border border-zinc-400 bg-[#b0b0b0] p-2 shadow-inner">
                <span className="mb-1 font-mono text-[8px] font-bold text-zinc-700">EdgeNode</span>
                </div>

                <div className="absolute top-40 left-1/2 flex -translate-x-1/2 flex-col items-center">
                <span className="mb-1 font-mono text-[7px] text-zinc-500">RGB</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-zinc-400 bg-zinc-100 shadow-inner">
                    <div className="h-4 w-4 animate-[pulse_1s_infinite] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                </div>
                </div>

                <div className="absolute bottom-6 left-0 flex w-full justify-around px-4">
                <div className="flex flex-col items-center">
                    <div className="h-4 w-6 rounded-sm border border-zinc-600 bg-zinc-800"></div>
                    <span className="mt-1 text-[6px] font-bold text-zinc-500 uppercase">Boot</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="h-4 w-6 rounded-sm border border-zinc-600 bg-zinc-800"></div>
                    <span className="mt-1 text-[6px] font-bold text-zinc-500 uppercase">Reset</span>
                </div>
                </div>

                <div className="absolute -bottom-1 left-0 flex w-full justify-between px-6">
                <div className="h-3 w-8 rounded-t-sm border-x border-t border-zinc-600 bg-zinc-900"></div>
                <div className="h-3 w-8 rounded-t-sm border-x border-t border-zinc-600 bg-zinc-900"></div>
                </div>

                <div className="absolute top-12 -left-0 flex flex-col gap-3">
                <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-r-sm border border-yellow-600 bg-yellow-500"></div>
                    <span className="font-mono text-[7px] text-white/70">3V3</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-r-sm border border-yellow-600 bg-yellow-500"></div>
                    <span className="font-mono text-[7px] text-white/70">RST</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-r-sm border border-yellow-600 bg-yellow-500"></div>
                    <span className="font-mono text-[7px] text-white/70">IO4</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-r-sm border border-yellow-600 bg-yellow-500"></div>
                    <span className="font-mono text-[7px] text-white/70">IO5</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-r-sm border border-yellow-600 bg-yellow-500"></div>
                    <span className="font-mono text-[7px] text-white/70">IO6</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-r-sm border border-yellow-600 bg-yellow-500"></div>
                    <span className="font-mono text-[7px] text-white/70">IO7</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-r-sm border border-yellow-600 bg-yellow-500"></div>
                    <span className="font-mono text-[7px] text-white/70">5V</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-r-sm border border-yellow-600 bg-yellow-500"></div>
                    <span className="font-mono text-[7px] text-white/70">GND</span>
                </div>
                </div>

                <div className="absolute top-12 -right-0 flex flex-col items-end gap-3">
                <div className="flex items-center gap-1">
                    <span className="font-mono text-[7px] text-white/70">GND</span>
                    <div className="h-3 w-3 rounded-l-sm border border-yellow-600 bg-yellow-500"></div>
                </div>
                <div className="flex items-center gap-1">
                    <span className="font-mono text-[7px] text-white/70">TX</span>
                    <div className="h-3 w-3 rounded-l-sm border border-yellow-600 bg-yellow-500"></div>
                </div>
                <div className="flex items-center gap-1">
                    <span className="font-mono text-[7px] text-white/70">RX</span>
                    <div className="h-3 w-3 rounded-l-sm border border-yellow-600 bg-yellow-500"></div>
                </div>
                <div className="flex items-center gap-1">
                    <span className="font-mono text-[7px] text-white/70">IO1</span>
                    <div className="h-3 w-3 rounded-l-sm border border-yellow-600 bg-yellow-500"></div>
                </div>
                <div className="flex items-center gap-1">
                    <span className="font-mono text-[7px] text-white/70">IO2</span>
                    <div className="h-3 w-3 rounded-l-sm border border-yellow-600 bg-yellow-500"></div>
                </div>
                <div className="flex items-center gap-1">
                    <span className="font-mono text-[7px] text-white/70">I42</span>
                    <div className="h-3 w-3 rounded-l-sm border border-yellow-600 bg-yellow-500"></div>
                </div>
                <div className="flex items-center gap-1">
                    <span className="font-mono text-[7px] text-white/70">I41</span>
                    <div className="h-3 w-3 rounded-l-sm border border-yellow-600 bg-yellow-500"></div>
                </div>
                <div className="flex items-center gap-1">
                    <span className="font-mono text-[7px] text-white/70">GND</span>
                    <div className="h-3 w-3 rounded-l-sm border border-yellow-600 bg-yellow-500"></div>
                </div>
                </div>
            </div>
        </div>
    </>
    );
};

export default Loader;