// src/components/Skeletons.tsx
import Loader from './Loader';

export const SkeletonCard = () => (
  <div className="bg-panel p-5 rounded-lg border-l-4 border-border-color shadow-sm relative overflow-hidden flex flex-col justify-between h-32 animate-pulse">
    <div className="flex justify-between items-start">
      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
      <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
    </div>
    <div className="flex items-baseline gap-2 mt-4">
      <div className="h-8 bg-gray-300 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
    </div>
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-4">
      <div className="h-1.5 rounded-full bg-gray-300 w-2/3"></div>
    </div>
  </div>
);

export const SkeletonChart = () => (
  <div className="bg-panel p-5 rounded-lg shadow-sm border border-border-color flex flex-col animate-pulse h-[300px]">
    <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
    <div className="flex-1 w-full flex items-end gap-2 px-2">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="bg-gray-200 w-full rounded-t-sm" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
      ))}
    </div>
  </div>
);

export const SkeletonTable = ({ rows = 5 }: { rows?: number }) => (
  <div className="w-full bg-panel rounded-lg border border-border-color overflow-hidden shadow-sm animate-pulse">
    <div className="bg-app px-6 py-4 border-b border-border-color flex justify-between items-center">
      <div className="h-5 bg-gray-300 rounded w-1/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/6"></div>
    </div>
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-panel border-b border-border-color">
          <th className="px-6 py-3"><div className="h-3 bg-gray-200 rounded w-2/3"></div></th>
          <th className="px-6 py-3"><div className="h-3 bg-gray-200 rounded w-1/2"></div></th>
          <th className="px-6 py-3"><div className="h-3 bg-gray-200 rounded w-3/4"></div></th>
          <th className="px-6 py-3"><div className="h-3 bg-gray-200 rounded w-1/3 ml-auto"></div></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {[...Array(rows)].map((_, i) => (
          <tr key={i}>
            <td className="px-6 py-4"><div className="h-4 bg-gray-300 rounded w-3/4"></div></td>
            <td className="px-6 py-4"><div className="h-5 bg-gray-200 rounded-full w-20"></div></td>
            <td className="px-6 py-4"><div className="h-3 bg-gray-200 rounded w-1/2"></div></td>
            <td className="px-6 py-4 flex justify-end"><div className="h-6 w-6 bg-gray-200 rounded"></div></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const SkeletonForm = () => (
  <div className="bg-app p-6 rounded-lg border border-border-color animate-pulse space-y-6">
    <div className="flex items-center gap-2 mb-4 border-b border-border-color pb-2">
      <div className="h-5 w-5 bg-gray-300 rounded"></div>
      <div className="h-5 bg-gray-300 rounded w-1/3"></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
        <div className="h-10 bg-gray-200 rounded w-full"></div>
      </div>
      <div>
        <div className="h-4 bg-gray-300 rounded w-1/3 mb-2"></div>
        <div className="h-10 bg-gray-200 rounded w-full"></div>
      </div>
      <div className="md:col-span-2">
        <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
        <div className="h-10 bg-gray-200 rounded w-full"></div>
      </div>
    </div>
    <div className="flex justify-end pt-4">
      <div className="h-10 bg-gray-300 rounded w-32"></div>
    </div>
  </div>
);

export const BlockLoader = () => (
  <div className="w-full flex items-center justify-center p-8 bg-gray-900/5 rounded-lg border border-gray-800/10">
    <div className="transform scale-75 origin-center">
      <Loader fullScreen={false} />
    </div>
  </div>
);
